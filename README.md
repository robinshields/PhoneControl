# PhoneControl

Turn your phone into a wireless slideshow remote for your Mac — point your camera at a QR code, and a website will open with forward and back controls. Also offers functionality as a remote keyboard or touchbpad mouse.

## Accessibility Permission (One-Time)

macOS requires explicit permission to trigger keystrokes or mouse movement. The first time PhoneControl needs to do this, macOS should prompt you automatically — click **Allow**. If the prompt never appears, or you dismissed it by mistake:

1. Open **System Settings** → **Privacy & Security** → **Accessibility**.
2. Find the app that ran PhoneControl in the list — **Terminal** (or iTerm, etc.) if you ran it with `npm start`, or **phonecontrol-arm64**/**phonecontrol-x64** if you ran the standalone binary.
3. Turn its toggle **on**. If it isn't listed at all, click **+**, browse to the app (Terminal is in `/Applications/Utilities`), and add it.
4. Stop PhoneControl (<kbd>Ctrl</kbd>+<kbd>C</kbd>) and start it again.


## Run from source

```bash
npm install
npm start
```

Scan the QR code printed in your terminal with your phone's camera. That's it — your phone is now a remote.

## Slideshow remote (the main event)

By default, PhoneControl starts in **controller mode**: your phone shows just two big buttons, Back and Forward. 

## Other modes

PhoneControl also offers wireless keyboard and trackpad modes, available via a mode argument on startup:

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

## Run from binary

(No node installation required)

1. **[Download the latest release](https://github.com/robinshields/PhoneControl/releases/latest/download/bin.zip)**
2. Unzip it:
   ```bash
   unzip bin.zip && cd bin
   ```
3. Make the one matching your Mac executable:
   ```bash
   chmod +x phonecontrol-arm64   # Apple Silicon
   chmod +x phonecontrol-x64     # Intel
   ```
4. Run it:
   ```bash
   ./phonecontrol-arm64            # controller mode (default)
   ./phonecontrol-arm64 keyboard
   ./phonecontrol-arm64 mouse
   ```

Since the binary isn't notarized, macOS Gatekeeper will likely refuse to open it on the first attempt. You will need to grant permissions for the binary to run


## Build binary

Build the standalone executables yourself instead of downloading them — the Node runtime, the app, and its native dependencies are all packed into one file per architecture, so the result runs on a bare Mac with nothing pre-installed:

```bash
npm install
npm run build
```

This produces two files in `./bin`:

- `phonecontrol-arm64` — Apple Silicon Macs
- `phonecontrol-x64` — Intel Macs

Copy the right one (or zip up both and let the recipient pick) to any Mac and run it directly, mode argument and all — see [Run from binary](#run-from-binary) above.

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

- macOS with Node.js 18+ (only if running from source — see [Run from binary](#run-from-binary) for a Node-free option)
- Mac and phone on the same WiFi network
- Accessibility permission granted — see [above](#accessibility-permission)
