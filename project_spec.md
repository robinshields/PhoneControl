# PhoneControl for Mac

## Overview
A lightweight, no-app-required system that turns any phone's web browser into a wireless keyboard, mouse, and slideshow remote for a Mac. A Node.js server runs locally on the Mac, serves webpage over WiFi, and relays keystrokes and events back to the Mac in real time — no native app, no Bluetooth pairing, no App Store install.

## How It Works
1. Node.js server starts on the Mac and detects the machine's local WiFi IP address.
2. Server prints a QR code to the terminal encoding the local URL (e.g. `http://192.168.1.42:3000`).
3. User scans the QR code with their phone camera, opening a simple keyboard webpage in the browser — no app install needed.
4. Phone and Mac establish a WebSocket connection (via Socket.io) for low-latency, bidirectional communication.
5. Each keypress/tap on the phone's webpage is sent instantly over the WebSocket to the Node server.
6. The server simulates the corresponding keystroke on the Mac using a native automation library.

## The Webpage Structure
1. The webpage has three small tabs at the top, with icons or text for keyboard, remote and mouse
2. Each shows a different display on the webpage, keyboard is a QWERTY keyboard, a mouse is a trackpad (shaded rectangle, rounded corners), a remove simply has forward and back buttons
3. The websockets would reconnect to the server after disconnecting


## Security features
1. The port is selected randomly on startup (range 1000 to 9999)
2. On first serve of the page a cyptographic key is also served as a cookie. The key is required for all keystroke/mouse events in the websocket message.
3. If they page is re-served after first loading, the key is required (i.e. only the first device to connect would be able to connect again)
4. The server can only bind to LAN addresses (not 0.0.0.0)
6. After an HTTP request with no key, or three bad key requests, the app exits

## Core Technologies & Libraries

| Purpose | Choice | Notes |
|---|---|---|
| Runtime | **Node.js** | Chosen over Python for native WebSocket ecosystem and shared JS across front/back end |
| Web server | **Express.js** | Serves the keyboard webpage and static assets |
| Realtime communication | **Socket.io** | Wraps WebSockets with auto-reconnect and fallback to long-polling |
| Keystroke simulation and mouse movements | **`@nut-tree/nut-js`** (preferred) or **`robotjs`** | Simulates keyboard input on macOS; alternative: shell out to `osascript`/AppleScript via `child_process` |
| Local IP detection | Node's built-in **`os`** module | `os.networkInterfaces()` to find the active WiFi (`en0`) IPv4 address |
| QR code generation | **`qrcode-terminal`** | Prints a scannable QR code directly in the terminal for easy connection |
| Frontend | Plain **HTML/CSS/JS** | Simple on-screen keyboard UI served to the phone's browser |

