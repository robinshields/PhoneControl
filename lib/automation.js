'use strict';

// Wraps @nut-tree/nut-js so the rest of the server never touches the
// automation library directly. If nut-js fails to load (e.g. native
// bindings not built for this platform), automation calls become no-ops
// that log a warning instead of crashing the whole server.

let keyboard, mouse, Key, Button, Point;
let available = true;

try {
  ({ keyboard, mouse, Key, Button, Point } = require('@nut-tree-fork/nut-js'));
  keyboard.config.autoDelayMs = 0;
  mouse.config.autoDelayMs = 0;
  mouse.config.mouseSpeed = 4000;
} catch (err) {
  available = false;
  console.error(
    '[automation] @nut-tree/nut-js failed to load — keystroke/mouse simulation is disabled.\n' +
      '  (' + err.message + ')\n' +
      '  You may need to rebuild native dependencies for this machine: npm rebuild'
  );
}

// Maps the special key labels the on-screen keyboard can send to nut-js
// Key enum values. Printable characters (letters, digits, punctuation)
// are sent as literal strings and typed directly instead.
const SPECIAL_KEY_MAP = {
  Backspace: 'Backspace',
  Enter: 'Enter',
  Tab: 'Tab',
  Space: 'Space',
  Escape: 'Escape',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
};

function resolveKey(label) {
  if (!available) return null;
  const mapped = SPECIAL_KEY_MAP[label];
  return mapped ? Key[mapped] : null;
}

async function handleKeypress({ key } = {}) {
  if (!available || typeof key !== 'string' || key.length === 0) return;

  const special = resolveKey(key);
  try {
    if (special) {
      await keyboard.pressKey(special);
      await keyboard.releaseKey(special);
    } else {
      // Printable character(s) — type it verbatim.
      await keyboard.type(key);
    }
  } catch (err) {
    console.error('[automation] keypress failed:', err.message);
  }
}

async function handleMouseMove({ dx, dy } = {}) {
  if (!available) return;
  const deltaX = Number(dx) || 0;
  const deltaY = Number(dy) || 0;
  if (deltaX === 0 && deltaY === 0) return;

  try {
    const pos = await mouse.getPosition();
    await mouse.setPosition(new Point(pos.x + deltaX, pos.y + deltaY));
  } catch (err) {
    console.error('[automation] mouse move failed:', err.message);
  }
}

async function handleMouseClick({ button } = {}) {
  if (!available) return;
  try {
    await mouse.click(button === 'right' ? Button.RIGHT : Button.LEFT);
  } catch (err) {
    console.error('[automation] mouse click failed:', err.message);
  }
}

async function handleScroll({ dy } = {}) {
  if (!available) return;
  const amount = Math.round(Number(dy) || 0);
  if (amount === 0) return;

  try {
    if (amount > 0) {
      await mouse.scrollDown(amount);
    } else {
      await mouse.scrollUp(-amount);
    }
  } catch (err) {
    console.error('[automation] scroll failed:', err.message);
  }
}

async function handleRemote({ action } = {}) {
  if (!available) return;
  const target = action === 'forward' ? Key.Right : Key.Left;

  try {
    await keyboard.pressKey(target);
    await keyboard.releaseKey(target);
  } catch (err) {
    console.error('[automation] remote action failed:', err.message);
  }
}

module.exports = {
  handleKeypress,
  handleMouseMove,
  handleMouseClick,
  handleScroll,
  handleRemote,
};
