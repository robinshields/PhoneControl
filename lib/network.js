'use strict';

const os = require('os');

// Interface names checked first, in order, since macOS WiFi is almost
// always en0. Falls back to scanning every interface for a private,
// non-internal IPv4 address (covers en1, USB ethernet dongles, etc).
const PREFERRED_INTERFACES = ['en0', 'en1'];

/**
 * Finds the Mac's local WiFi/LAN IPv4 address.
 * Returns null if no suitable interface is found (e.g. no WiFi connection).
 */
function getLanAddress() {
  const interfaces = os.networkInterfaces();

  for (const name of PREFERRED_INTERFACES) {
    const addrs = interfaces[name];
    if (!addrs) continue;
    const ipv4 = addrs.find((a) => a.family === 'IPv4' && !a.internal);
    if (ipv4) return ipv4.address;
  }

  for (const name of Object.keys(interfaces)) {
    const addrs = interfaces[name] || [];
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address;
    }
  }

  return null;
}

module.exports = { getLanAddress };
