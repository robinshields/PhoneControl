'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const express = require('express');
const cookieParser = require('cookie-parser');
const cookie = require('cookie');
const { Server } = require('socket.io');
const qrcodeTerminal = require('qrcode-terminal');

const { getLanAddress } = require('./lib/network');
const automation = require('./lib/automation');

const COOKIE_NAME = 'pc_token';
const MAX_BAD_ATTEMPTS = 3;
const MIN_PORT = 1000;
const MAX_PORT = 9999;

// ---------------------------------------------------------------------------
// Mode: controls which control surfaces (and which socket.io events) are
// live. This is the main security lever for a phone/network you don't
// fully trust — e.g. "controller" mode never even registers a listener
// for keypress/mouse events, so there's no way for a stray or malicious
// client to trigger them, UI hiding aside.
//
//   controller (default) — slide remote only
//   keyboard              — keyboard + slide remote
//   mouse / all           — everything (keyboard, remote, trackpad)
// ---------------------------------------------------------------------------

const DEFAULT_MODE = 'controller';
const MODE_ORDER = ['controller', 'keyboard', 'mouse'];
const MODE_ALIASES = { all: 'mouse' };
const MODE_EVENTS = {
  controller: ['remote'],
  keyboard: ['remote', 'keypress'],
  mouse: ['remote', 'keypress', 'mousemove', 'mouseclick', 'mousescroll'],
};

function parseMode(argv) {
  const raw = (argv[2] || DEFAULT_MODE).toLowerCase();
  const resolved = MODE_ALIASES[raw] || raw;
  if (!MODE_ORDER.includes(resolved)) {
    console.error(
      `Unknown mode "${argv[2]}". Valid modes: controller (default), keyboard, mouse (or "all").`
    );
    process.exit(1);
  }
  return resolved;
}

const MODE = parseMode(process.argv);
const ALLOWED_EVENTS = new Set(MODE_EVENTS[MODE]);

function printModeBanner() {
  const suffix = (m) => (m === DEFAULT_MODE ? ' (default)' : '');
  const otherLabel = (m) => `"${m}"${suffix(m)}`;
  const others = MODE_ORDER.filter((m) => m !== MODE).map(otherLabel).join(' and ');
  console.log(`Running in ${MODE} mode${suffix(MODE)}. ${others} modes also available.`);
}

// ---------------------------------------------------------------------------
// Startup: pick a random port and find the LAN (WiFi) address to bind to.
// ---------------------------------------------------------------------------

const PORT = Math.floor(Math.random() * (MAX_PORT - MIN_PORT + 1)) + MIN_PORT;
const HOST = getLanAddress();

if (!HOST) {
  console.error(
    'Could not find a LAN IPv4 address to bind to. Make sure this Mac is connected to WiFi (or a LAN) and try again.'
  );
  process.exit(1);
}

const TOKEN = crypto.randomBytes(32).toString('hex');
const INDEX_TEMPLATE = fs.readFileSync(path.join(__dirname, 'views', 'index.html'), 'utf8');

let pageServed = false;
let badAttempts = 0;
let shuttingDown = false;

function shutdown(reason) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.error(`\n[security] ${reason} — shutting down.\n`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Express app + security gate
//
// Rules (see project_spec.md):
//  - The very first GET / is served for free; it mints the token and sets
//    it as a cookie on the response.
//  - Every request after that (including reloads of "/", static assets,
//    etc.) must present the token cookie/query param.
//  - A request with no token at all kills the server outright.
//  - A request with a wrong token counts as a "bad attempt"; three of
//    those also kill the server.
// ---------------------------------------------------------------------------

// Browsers request these automatically and unpredictably — often in
// parallel with the very first page load, sometimes before the cookie
// from that load has even round-tripped. They carry no control
// capability, so they're exempt from the key gate entirely rather than
// tripping the intrusion tripwire below.
const EXEMPT_PATHS = new Set([
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/apple-touch-icon-precomposed.png',
  '/robots.txt',
]);

const app = express();
app.use(cookieParser());

app.use((req, res, next) => {
  if (EXEMPT_PATHS.has(req.path)) {
    return res.status(404).end();
  }

  if (req.method === 'GET' && req.path === '/' && !pageServed) {
    pageServed = true;
    res.cookie(COOKIE_NAME, TOKEN, { httpOnly: false, sameSite: 'strict' });
    return next();
  }

  const provided = req.cookies[COOKIE_NAME] || req.query.token;

  if (!provided) {
    res.status(400).end();
    shutdown(`HTTP request to ${req.method} ${req.path} with no key`);
    return;
  }

  if (provided !== TOKEN) {
    badAttempts += 1;
    console.warn(`[security] bad key on ${req.path} (${badAttempts}/${MAX_BAD_ATTEMPTS})`);
    if (badAttempts >= MAX_BAD_ATTEMPTS) {
      res.status(403).end();
      shutdown('too many bad key attempts');
      return;
    }
    return res.status(403).end();
  }

  next();
});

app.get('/', (req, res) => {
  res.type('html').send(INDEX_TEMPLATE.replace('__PC_MODE__', MODE));
});

app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server);

// ---------------------------------------------------------------------------
// Socket.io: same key rules apply, but requests to /socket.io/* are
// handled by engine.io directly and never pass through the Express
// middleware above, so we re-check the token here at connection time and
// again on every individual event payload, per the spec.
// ---------------------------------------------------------------------------

function tokenFromHandshake(socket) {
  const header = socket.handshake.headers.cookie;
  if (!header) return null;
  const parsed = cookie.parse(header);
  return parsed[COOKIE_NAME] || null;
}

function checkToken(providedToken, socket) {
  if (!providedToken) {
    shutdown('WebSocket message with no key');
    return false;
  }
  if (providedToken !== TOKEN) {
    badAttempts += 1;
    console.warn(`[security] bad websocket key (${badAttempts}/${MAX_BAD_ATTEMPTS})`);
    if (badAttempts >= MAX_BAD_ATTEMPTS) {
      shutdown('too many bad key attempts');
    } else {
      socket.disconnect(true);
    }
    return false;
  }
  return true;
}

// Only events allowed by the current mode get a listener at all — a
// client sending a "mousemove" while running in "controller" mode has
// nothing to trigger it, regardless of what the served page does.
const EVENT_HANDLERS = {
  keypress: automation.handleKeypress,
  mousemove: automation.handleMouseMove,
  mouseclick: automation.handleMouseClick,
  mousescroll: automation.handleScroll,
  remote: automation.handleRemote,
};

io.on('connection', (socket) => {
  if (!checkToken(tokenFromHandshake(socket), socket)) {
    return;
  }

  for (const [event, handler] of Object.entries(EVENT_HANDLERS)) {
    if (!ALLOWED_EVENTS.has(event)) continue;
    socket.on(event, (data) => {
      if (!checkToken(data && data.token, socket)) return;
      handler(data);
    });
  }
});

// ---------------------------------------------------------------------------
// Go!
// ---------------------------------------------------------------------------

server.listen(PORT, HOST, () => {
  const url = `http://${HOST}:${PORT}`;
  console.log('\nPhoneControl is running.\n');
  printModeBanner();
  console.log(`\n  ${url}\n`);
  qrcodeTerminal.generate(url, { small: true }, (qr) => console.log(qr));
  console.log('Scan this QR code with your phone camera to connect.');
  console.log('Only the first device to load the page will be able to control this Mac.\n');
});
