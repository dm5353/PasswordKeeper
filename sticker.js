let stickers = [];
let counter = 0;
let timeoutId = null;

/* ---------- восстановление ---------- */
chrome.storage.local.get("stickers", data => {
  const currentDomain = new URL(window.location.href).hostname;
  const stickersToDraw = (data.stickers || []).filter(s => s.domain === currentDomain);
  
  // Восстанавливаем стикеры последовательно
  stickersToDraw.forEach(sticker => {
    createSticker(sticker, sticker.login, sticker.password, sticker.theme);
  });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "toggleSticker") {
    createSticker(null, msg.login, msg.password, msg.theme);
  }
});

/* ---------- создание ---------- */
function createSticker(saved, initialLogin, initialPassword, theme) {
  const id = saved?.id || "sticker_" + counter++;
  const pos = saved?.pos || { x: 100, y: 100 };
  const stickerTheme = theme || (document.body.classList.contains("light") ? "light" : "dark");

  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = pos.x + "px";
  host.style.top = pos.y + "px";
  host.style.zIndex = "2147483647";

  const shadow = host.attachShadow({ mode: "closed" });

  fetch(chrome.runtime.getURL("sticker.html"))
    .then(res => res.text())
    .then(html => {
      const box = document.createElement("div");
      box.innerHTML = html;
      box.style.cssText = `
        cursor:move;
        user-select:none;
      `;
      shadow.appendChild(box);
      
      // Загружаем и применяем стили
      return fetch(chrome.runtime.getURL("stickerStyle.css"))
        .then(res => res.text())
        .then(css => {
          const style = document.createElement("style");
          style.textContent = css;
          shadow.appendChild(style);
          
          // Возвращаем box чтобы он был доступен дальше
          return box;
        });
    })
    .then(box => {
      waitBody(() => document.body.appendChild(host));
      
      // Применяем тему к стикеру
      const stickerBox = box.querySelector(".sticker-box");
      if (stickerTheme === "light") {
        stickerBox.classList.add("light");
      }
      
      // Восстанавливаем сохранённые логин и пароль
      const loginInput = box.querySelector(".sticker-login");
      const passwordInput = box.querySelector(".sticker-password");
      
      if (saved?.login) {
        loginInput.value = saved.login;
      } else if (initialLogin) {
        loginInput.value = initialLogin;
      }
      
      if (saved?.password) {
        passwordInput.value = saved.password;
      } else if (initialPassword) {
        passwordInput.value = initialPassword;
      }
      
      // Сохраняем начальные значения если это новый стикер
      if (initialLogin || initialPassword) {
        const domain = new URL(window.location.href).hostname;
        saveCredentials(id, loginInput.value, passwordInput.value, domain, stickerTheme);
      }
      
      // Кнопка удаления
      const closeBtn = box.querySelector(".sticker-close");
      closeBtn.addEventListener("click", () => {
        deleteSticker(id, host);
      });
      
      // Копирование + автосброс
      box.querySelectorAll("button[data-copy]").forEach(btn => {
        btn.addEventListener("click", () => {
          // сброс всех индикаторов и таймера
          clearTimeout(timeoutId);
          box.querySelectorAll(".status").forEach(s => s.classList.remove("show"));

          const fieldId = btn.dataset.copy;
          const input = box.querySelector("#" + fieldId);
          const status = box.querySelector("#status-" + fieldId);

          navigator.clipboard.writeText(input.value).then(() => {
            status.classList.add("show");

            // через 1 секунду убираем класс show — срабатывает плавный переход opacity
            timeoutId = setTimeout(() => {
              status.classList.remove("show");
            }, 1000);
          });
        });
      });
      
      makeDraggable(host, id);
      stickers.push({ id, host });
    });
}

/* ---------- drag + сохранение ---------- */
function makeDraggable(el, id) {
  let dx, dy, down = false;

  el.addEventListener("mousedown", e => {
    down = true;
    dx = e.clientX - el.offsetLeft;
    dy = e.clientY - el.offsetTop;
  });

  document.addEventListener("mousemove", e => {
    if (!down) return;
    el.style.left = e.clientX - dx + "px";
    el.style.top = e.clientY - dy + "px";
  });

  document.addEventListener("mouseup", () => {
    if (!down) return;
    down = false;
    savePosition(id, el.offsetLeft, el.offsetTop);
  });
}

/* ---------- storage ---------- */
function savePosition(id, x, y) {
  chrome.storage.local.get("stickers", data => {
    const list = data.stickers || [];
    const item = list.find(s => s.id === id) || { id, domain: new URL(window.location.href).hostname };
    item.pos = { x, y };
    if (!list.includes(item)) list.push(item);
    chrome.storage.local.set({ stickers: list });
  });
}

function saveCredentials(id, login, password, domain, theme) {
  chrome.storage.local.get("stickers", data => {
    const list = data.stickers || [];
    const item = list.find(s => s.id === id) || { id, domain };
    item.login = login;
    item.password = password;
    item.theme = theme;
    if (!list.includes(item)) list.push(item);
    chrome.storage.local.set({ stickers: list });
  });
}

function deleteSticker(id, host) {
  host.remove();
  stickers = stickers.filter(s => s.id !== id);
  chrome.storage.local.get("stickers", data => {
    const list = (data.stickers || []).filter(s => s.id !== id);
    chrome.storage.local.set({ stickers: list });
  });
}

/* ---------- util ---------- */
function waitBody(cb) {
  if (document.body) {
    cb();
  } else {
    setTimeout(() => waitBody(cb), 10);
  }
}