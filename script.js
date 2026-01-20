const login = document.getElementById("login");
const password = document.getElementById("password");
const themeBtn = document.getElementById("themeToggle");
let timeoutId = null;

/* ---------- загрузка ---------- */
chrome.storage.local.get(["login", "password", "theme"], data => {
  login.value = data.login || "";
  password.value = data.password || "";
  if (data.theme === "light") document.body.classList.add("light");
  updateThemeIcon();
});

/* ---------- сохранение ---------- */
login.addEventListener("input", () =>
  chrome.storage.local.set({ login: login.value })
);

password.addEventListener("input", () =>
  chrome.storage.local.set({ password: password.value })
);

/* ---------- тема ---------- */
function updateThemeIcon() {
  themeBtn.textContent =
    document.body.classList.contains("light") ? "☀️" : "🌙";
}

themeBtn.onclick = () => {
  document.body.classList.toggle("light");
  chrome.storage.local.set({
    theme: document.body.classList.contains("light") ? "light" : "dark"
  });
  updateThemeIcon();
};

/* ---------- кнопка стикера ---------- */
document.getElementById("showSticker").onclick = () => {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (!tabs[0]?.id) return;
    chrome.tabs.sendMessage(tabs[0].id, { 
      action: "toggleSticker",
      login: login.value,
      password: password.value,
      theme: document.body.classList.contains("light") ? "light" : "dark"
    }, () => {
      chrome.runtime.lastError;
    });
  });
};

/* ---------- копирование + автосброс ---------- */
document.querySelectorAll("button[data-copy]").forEach(btn => {
  btn.addEventListener("click", () => {
    // сброс всех индикаторов и таймера
    clearTimeout(timeoutId);
    document.querySelectorAll(".status").forEach(s => s.classList.remove("show"));

    const id = btn.dataset.copy;
    const input = document.getElementById(id);
    const status = document.getElementById("status-" + id);

    navigator.clipboard.writeText(input.value).then(() => {
      status.classList.add("show");

      // через 1 секунду убираем класс show — срабатывает плавный переход opacity
      timeoutId = setTimeout(() => {
        status.classList.remove("show");
      }, 1000);
    });
  });
});

/* ---------- обновление ---------- */
checkForUpdate();

async function checkForUpdate() {
  try {
    const current = chrome.runtime.getManifest().version;

    const res = await fetch(
      "https://raw.githubusercontent.com/dm5353/PasswordKeeper/main/version.json",
      { cache: "no-store" }
    );
    const data = await res.json();

    if (isNewerVersion(data.version, current)) {
      showUpdate(data.version, data.url);
    }
  } catch {
    // молча — popup не должен ломаться
  }
}

function isNewerVersion(remote, local) {
  const r = remote.split(".").map(Number);
  const l = local.split(".").map(Number);

  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    if ((r[i] || 0) > (l[i] || 0)) return true;
    if ((r[i] || 0) < (l[i] || 0)) return false;
  }
  return false;
}

function showUpdate(version, url) {
  const box = document.getElementById("updateBox");
  const text = document.getElementById("updateText");
  const btn = document.getElementById("updateBtn");

  text.textContent = `Доступна версия ${version}`;
  box.classList.remove("hidden");

  btn.onclick = () => {
    chrome.tabs.create({ url });
  };
}
/* ---------- конец файла script.js ---------- */