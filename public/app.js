(() => {
  'use strict';

  // ---------------------------------------------------------------------
  // Auth token — handed to us as a cookie by the server on first load.
  // Every socket message must carry it.
  // ---------------------------------------------------------------------
  function getCookie(name) {
    const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  }
  const TOKEN = getCookie('pc_token');

  // ---------------------------------------------------------------------
  // Mode — which tabs are shown is dictated by the server (see server.js
  // MODE_EVENTS): a mode that doesn't allow, say, mouse events also never
  // registers a socket listener for them, so hiding the tab here is a UX
  // nicety on top of real server-side enforcement, not the enforcement
  // itself. Falls back to the most restrictive mode if injection failed.
  // ---------------------------------------------------------------------
  const MODE_TABS = {
    controller: { tabs: ['remote'], defaultTab: 'remote' },
    keyboard: { tabs: ['keyboard', 'remote'], defaultTab: 'keyboard' },
    mouse: { tabs: ['keyboard', 'remote', 'mouse'], defaultTab: 'keyboard' },
  };
  const MODE = MODE_TABS[window.PC_MODE] ? window.PC_MODE : 'controller';
  const { tabs: ENABLED_TABS, defaultTab: DEFAULT_TAB } = MODE_TABS[MODE];
  const tabEnabled = (name) => ENABLED_TABS.includes(name);

  // ---------------------------------------------------------------------
  // Socket.io connection — reconnects automatically after a drop.
  // ---------------------------------------------------------------------
  const socket = io({
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000,
  });

  const statusEl = document.getElementById('status');
  function setStatus(state, text) {
    statusEl.className = 'status status--' + state;
    statusEl.textContent = text;
  }

  socket.on('connect', () => setStatus('connected', 'Connected'));
  socket.on('disconnect', () => setStatus('disconnected', 'Disconnected — reconnecting…'));
  socket.io.on('reconnect_attempt', () => setStatus('connecting', 'Reconnecting…'));

  function send(event, payload) {
    socket.emit(event, Object.assign({ token: TOKEN }, payload || {}));
  }

  // ---------------------------------------------------------------------
  // Tabs — remove anything this mode doesn't allow, then activate the
  // mode's default tab.
  // ---------------------------------------------------------------------
  document.querySelectorAll('.tab').forEach((tab) => {
    if (!tabEnabled(tab.dataset.tab)) tab.remove();
  });
  document.querySelectorAll('.panel').forEach((panel) => {
    if (!tabEnabled(panel.id.replace('panel-', ''))) panel.remove();
  });

  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.panel');

  if (tabs.length <= 1) {
    document.querySelector('.tabs').style.display = 'none';
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      panels.forEach((p) => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
    });
  });

  tabs.forEach((t) => t.classList.remove('active'));
  panels.forEach((p) => p.classList.remove('active'));
  const activeTab = document.querySelector(`.tab[data-tab="${DEFAULT_TAB}"]`);
  const activePanel = document.getElementById('panel-' + DEFAULT_TAB);
  if (activeTab) activeTab.classList.add('active');
  if (activePanel) activePanel.classList.add('active');

  // ---------------------------------------------------------------------
  // Keyboard — only built (and only ever wired to emit "keypress") when
  // the current mode allows it.
  // ---------------------------------------------------------------------
  if (tabEnabled('keyboard')) {
  const LAYOUT = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    [
      { label: '⇧', key: '__shift', cls: 'key--wide key--shift' },
      'z', 'x', 'c', 'v', 'b', 'n', 'm',
      { label: '⌫', key: 'Backspace', cls: 'key--wide' },
    ],
    [
      { label: 'esc', key: 'Escape', cls: 'key--wide' },
      { label: ',', key: ',' },
      { label: 'space', key: 'Space', cls: 'key--space' },
      { label: '.', key: '.' },
      { label: '⏎', key: 'Enter', cls: 'key--wide' },
    ],
  ];

  const keyboardEl = document.getElementById('keyboard');
  let shiftActive = false;
  const letterButtons = [];

  function isLetter(k) {
    return typeof k === 'string' && k.length === 1 && /[a-z]/i.test(k);
  }

  LAYOUT.forEach((row) => {
    const rowEl = document.createElement('div');
    rowEl.className = 'kb-row';

    row.forEach((entry) => {
      const isObj = typeof entry === 'object';
      const key = isObj ? entry.key : entry;
      const label = isObj ? entry.label : entry;
      const cls = isObj ? entry.cls : '';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'key' + (cls ? ' ' + cls : '');
      btn.textContent = label;
      btn.dataset.key = key;

      if (isLetter(key)) letterButtons.push(btn);

      btn.addEventListener('touchstart', (e) => { e.preventDefault(); handleKey(key, btn); }, { passive: false });
      btn.addEventListener('click', () => handleKey(key, btn));

      rowEl.appendChild(btn);
    });

    keyboardEl.appendChild(rowEl);
  });

  function updateShiftDisplay() {
    letterButtons.forEach((btn) => {
      btn.textContent = shiftActive ? btn.dataset.key.toUpperCase() : btn.dataset.key;
    });
    const shiftBtn = keyboardEl.querySelector('.key--shift');
    if (shiftBtn) shiftBtn.classList.toggle('active', shiftActive);
  }

  function handleKey(key, btn) {
    btn.classList.add('pressed');
    setTimeout(() => btn.classList.remove('pressed'), 120);

    if (key === '__shift') {
      shiftActive = !shiftActive;
      updateShiftDisplay();
      return;
    }

    let outKey = key;
    if (isLetter(key)) {
      outKey = shiftActive ? key.toUpperCase() : key;
      if (shiftActive) {
        shiftActive = false;
        updateShiftDisplay();
      }
    }

    send('keypress', { key: outKey });
  }
  } // tabEnabled('keyboard')

  // ---------------------------------------------------------------------
  // Remote (forward / back) — available in every mode.
  // ---------------------------------------------------------------------
  document.getElementById('remote-forward').addEventListener('click', () => send('remote', { action: 'forward' }));
  document.getElementById('remote-back').addEventListener('click', () => send('remote', { action: 'back' }));

  // ---------------------------------------------------------------------
  // Mouse / trackpad — only wired (and only ever emits mouse events)
  // when the current mode allows it.
  // ---------------------------------------------------------------------
  if (tabEnabled('mouse')) {
  const trackpad = document.getElementById('trackpad');
  const MOVE_SCALE = 1.6;
  const TAP_MAX_DURATION = 250;
  const TAP_MAX_DISTANCE = 8;

  let lastX = 0;
  let lastY = 0;
  let touchStartTime = 0;
  let totalMovement = 0;
  let twoFinger = false;
  let lastScrollY = 0;

  trackpad.addEventListener('touchstart', (e) => {
    e.preventDefault();
    touchStartTime = Date.now();
    totalMovement = 0;
    twoFinger = e.touches.length >= 2;

    if (twoFinger) {
      lastScrollY = e.touches[0].clientY;
    } else {
      lastX = e.touches[0].clientX;
      lastY = e.touches[0].clientY;
    }
  }, { passive: false });

  trackpad.addEventListener('touchmove', (e) => {
    e.preventDefault();

    if (twoFinger || e.touches.length >= 2) {
      const y = e.touches[0].clientY;
      const dy = y - lastScrollY;
      lastScrollY = y;
      if (dy !== 0) send('mousescroll', { dy: -dy });
      return;
    }

    const touch = e.touches[0];
    const dx = (touch.clientX - lastX) * MOVE_SCALE;
    const dy = (touch.clientY - lastY) * MOVE_SCALE;
    lastX = touch.clientX;
    lastY = touch.clientY;
    totalMovement += Math.abs(dx) + Math.abs(dy);

    if (dx !== 0 || dy !== 0) send('mousemove', { dx, dy });
  }, { passive: false });

  trackpad.addEventListener('touchend', (e) => {
    e.preventDefault();
    const duration = Date.now() - touchStartTime;
    if (!twoFinger && duration < TAP_MAX_DURATION && totalMovement < TAP_MAX_DISTANCE) {
      send('mouseclick', { button: 'left' });
    }
    twoFinger = false;
  }, { passive: false });

  document.getElementById('mouse-left').addEventListener('click', () => send('mouseclick', { button: 'left' }));
  document.getElementById('mouse-right').addEventListener('click', () => send('mouseclick', { button: 'right' }));
  } // tabEnabled('mouse')
})();
