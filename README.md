# PhoneControl

Turn your phone into a wireless slideshow remote for your Mac — point your camera at a QR code, and you're clicking through slides. No app install, no Bluetooth pairing, no App Store. A keyboard and trackpad are available too, if you need them.

## Quick start

```bash
npm install
npm start
```

Scan the QR code printed in your terminal with your phone's camera. That's it — your phone is now a remote.

## Slideshow remote (the main event)

By default, PhoneControl starts in **controller mode**: your phone shows just two big buttons, Back and Forward. Scan, tap, present. This is deliberately the default and the simplest mode — most people picking up PhoneControl just want to advance slides from across the room without digging a clicker out of a bag.

Forward/Back send the Right/Left arrow keys, which drive slide navigation in Keynote, PowerPoint, Google Slides (in the browser), Preview, and most other presentation tools.

## Other modes

PhoneControl also does double duty as a wireless keyboard and trackpad, available via a mode argument on startup:

```bash
node server.js              # controller — remote only (default)
node server.js keyboard     # keyboard + remote
node server.js mouse        # keyboard + remote + trackpad
node server.js all          # same as "mouse"
```

| Mode | Shows | Use it when |
|---|---|---|
| `controller` (default) | Remote | You just need to advance slides |
| `keyboard` | Keyboard, Remote | You need to type something too (search box, notes, etc.) |
| `mouse` / `all` | Keyboard, Remote, Mouse | You want full remote control of the Mac |

The mode isn't just a UI toggle — the server only ever registers the socket events a given mode allows, so, e.g. in `controller` mode there is no code path that can move the mouse or type a key, even if something tried to send that event directly.

## Standalone binary

Don't want to deal with `npm install`? Build a single self-contained executable — the Node runtime, the app, and its native dependencies are all packed into one file, so it runs on a bare Mac with nothing pre-installed:

```bash
npm install
npm run build
```

This produces two files in `./bin`:

- `phonecontrol-arm64` — Apple Silicon Macs
- `phonecontrol-x64` — Intel Macs

Copy the right one (or zip up both and let the recipient pick) to any Mac and run it directly, mode argument and all:

```bash
./phonecontrol-arm64            # controller mode
./phonecontrol-arm64 keyboard
./phonecontrol-arm64 mouse
```

## How it works

1. The Node server picks a random port and finds your Mac's WiFi IP address.
2. It prints a QR code encoding that URL.
3. Your phone's camera scans it, opening a plain webpage — no install required.
4. The page and server talk over a Socket.io WebSocket connection, which reconnects automatically if you walk out of range.
5. Taps and keystrokes on the page are relayed to the server and simulated on the Mac.

## Security

- The port is randomized (1000–9999) on every run.
- The first device to load the page gets a one-time cryptographic token, set as a cookie. Every subsequent request — page reloads, static assets, WebSocket events — must present it.
- Any request missing the token entirely, or three requests with the wrong token, shuts the server down immediately.
- The server binds only to your Mac's LAN address, never `0.0.0.0`, so it's unreachable from outside your network.
- Only the socket events enabled by the current mode are ever wired up server-side (see [Other modes](#other-modes)).

## Requirements

- macOS with Node.js 18+
- Mac and phone on the same WiFi network
- Accessibility permission for Terminal/Node the first time it simulates a keystroke or mouse move (macOS will prompt automatically)
