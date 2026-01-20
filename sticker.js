let stickers = [];

const storageGet = key => new Promise(resolve => chrome.storage.local.get(key, data => resolve(data[key])));
const storageSet = obj => new Promise(resolve => chrome.storage.local.set(obj, () => resolve()));

function makeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return 'sticker_' + crypto.randomUUID();
  }
  return 'sticker_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e6).toString(36);
}

async function upsertSticker(item) {
  const list = (await storageGet('stickers')) || [];
  const idx = list.findIndex(s => s.id === item.id);
  if (idx >= 0) list[idx] = Object.assign({}, list[idx], item);
  else list.push(Object.assign({}, item));
  await storageSet({ stickers: list });
}

async function deleteFromStorage(id) {
  const list = (await storageGet('stickers')) || [];
  const newList = list.filter(s => s.id !== id);
  await storageSet({ stickers: newList });
}

(async function restore() {
  const all = (await storageGet('stickers')) || [];
  const currentDomain = window.location.origin + window.location.pathname;
  const stickersToDraw = all.filter(s => s.domain === currentDomain);
  for (const s of stickersToDraw) createSticker(s);
})();

chrome.runtime.onMessage.addListener(msg => {
  if (msg?.action === 'toggleSticker') createSticker(null, msg.login, msg.password, msg.theme);
});

async function createSticker(saved, initialLogin, initialPassword, themeArg) {
  const id = saved?.id || makeId();
  const pos = saved?.pos || { x: 100, y: 100 };
  const stickerTheme = (saved && saved.theme) || themeArg || (document.body.classList.contains('light') ? 'light' : 'dark');

  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = pos.x + 'px';
  host.style.top = pos.y + 'px';
  host.style.zIndex = String(2147483647);
  host.dataset.stickerId = id;

  const shadow = host.attachShadow({ mode: 'closed' });

  const [html, css] = await Promise.all([
    fetch(chrome.runtime.getURL('sticker.html')).then(r => r.text()),
    fetch(chrome.runtime.getURL('stickerStyle.css')).then(r => r.text())
  ]);

  const styleEl = document.createElement('style');
  styleEl.textContent = css;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;

  // Блокируем всплытие pointerdown для элементов с data-no-drag
  wrapper.querySelectorAll('[data-no-drag]').forEach(node => node.addEventListener('pointerdown', e => e.stopPropagation()));

  shadow.appendChild(styleEl);
  shadow.appendChild(wrapper);
  waitBody(() => document.body.appendChild(host));

  const stickerBox = wrapper.querySelector('.sticker-box');
  if (stickerBox) stickerBox.classList.toggle('light', stickerTheme === 'light');

  const loginInput = wrapper.querySelector('.sticker-login');
  const passwordInput = wrapper.querySelector('.sticker-password');

  if (loginInput) loginInput.value = saved?.login ?? initialLogin ?? '';
  if (passwordInput) passwordInput.value = saved?.password ?? initialPassword ?? '';

  if (!saved) {
    const domain = window.location.origin + window.location.pathname;
    await upsertSticker({
      id,
      domain,
      login: loginInput ? loginInput.value || '' : '',
      password: passwordInput ? passwordInput.value || '' : '',
      theme: stickerTheme,
      pos
    });
  }

  const state = { listeners: [], pointerCleanup: null, timeoutId: null };
  host._stickerState = state;

  const closeBtn = wrapper.querySelector('.sticker-close');
  if (closeBtn) {
    const onClose = () => deleteSticker(id, host);
    closeBtn.addEventListener('click', onClose);
    state.listeners.push({ node: closeBtn, type: 'click', handler: onClose });
  }

  wrapper.querySelectorAll('button[data-copy]').forEach(btn => {
    const onClick = async () => {
      if (state.timeoutId) { clearTimeout(state.timeoutId); state.timeoutId = null; }
      wrapper.querySelectorAll('.status').forEach(s => s.classList.remove('show'));
      const input = wrapper.querySelector('#' + btn.dataset.copy);
      const status = wrapper.querySelector('#status-' + btn.dataset.copy);
      if (!input) return;
      try {
        await navigator.clipboard.writeText(input.value);
        if (status) status.classList.add('show');
        state.timeoutId = setTimeout(() => { if (status) status.classList.remove('show'); state.timeoutId = null; }, 1000);
      } catch (err) {}
    };
    btn.addEventListener('click', onClick);
    state.listeners.push({ node: btn, type: 'click', handler: onClick });
  });

  const themeToggle = wrapper.querySelector('[data-theme-toggle]');
  if (themeToggle) {
    const onToggle = () => {
      const newTheme = stickerBox.classList.toggle('light') ? 'light' : 'dark';
      const domain = window.location.origin + window.location.pathname;
      upsertSticker({ id, domain, theme: newTheme });
    };
    themeToggle.addEventListener('click', onToggle);
    state.listeners.push({ node: themeToggle, type: 'click', handler: onToggle });
  }

  state.pointerCleanup = makeDraggable(host, id, (x, y) => savePosition(id, x, y));

  stickers.push({ id, host });
  return { id, host };
}

function makeDraggable(el, id, onSavePos) {
  let dragging = false;
  let startX = 0, startY = 0, originLeft = 0, originTop = 0, activePointer = null;

  function onPointerDown(e) {
    dragging = true;
    activePointer = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    originLeft = el.offsetLeft;
    originTop = el.offsetTop;
    try { el.setPointerCapture && el.setPointerCapture(activePointer); } catch (err) {}
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!dragging || e.pointerId !== activePointer) return;
    el.style.left = originLeft + (e.clientX - startX) + 'px';
    el.style.top = originTop + (e.clientY - startY) + 'px';
  }

  function onPointerUp(e) {
    if (!dragging || e.pointerId !== activePointer) return;
    dragging = false;
    try { el.releasePointerCapture && el.releasePointerCapture(activePointer); } catch (ignored) {}
    activePointer = null;
    onSavePos(el.offsetLeft, el.offsetTop);
  }

  el.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);

  return () => {
    el.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  };
}

function savePosition(id, x, y) {
  const domain = window.location.origin + window.location.pathname;
  upsertSticker({ id, domain, pos: { x, y } });
}

async function deleteSticker(id, host) {
  const state = host._stickerState;
  if (state) {
    if (state.timeoutId) clearTimeout(state.timeoutId);
    for (const { node, type, handler } of state.listeners) {
      try { node.removeEventListener(type, handler); } catch (e) {}
    }
    if (typeof state.pointerCleanup === 'function') state.pointerCleanup();
  }
  host.remove();
  stickers = stickers.filter(s => s.id !== id);
  await deleteFromStorage(id);
}

function waitBody(cb) {
  if (document.body) cb();
  else requestAnimationFrame(() => waitBody(cb));
}