const login = document.getElementById("login");
const password = document.getElementById("password");
const themeBtn = document.getElementById("themeToggle");
const statuses = document.querySelectorAll(".status");

/* ---------- загрузка сохранённых данных ---------- */
login.value = localStorage.getItem("login") || "";
password.value = localStorage.getItem("password") || "";

if (localStorage.getItem("theme") === "light") {
  document.body.classList.add("light");
}
updateThemeIcon();

/* ---------- сохранение при изменении ---------- */
login.addEventListener("input", () =>
  localStorage.setItem("login", login.value)
);

password.addEventListener("input", () =>
  localStorage.setItem("password", password.value)
);

/* ---------- переменные для таймера ---------- */
let timeoutId = null;

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

/* ---------- тема ---------- */
function updateThemeIcon() {
  themeBtn.textContent =
    document.body.classList.contains("light") ? "☀️" : "🌙";
}

themeBtn.addEventListener("click", () => {
  document.body.classList.toggle("light");
  localStorage.setItem(
    "theme",
    document.body.classList.contains("light") ? "light" : "dark"
  );
  updateThemeIcon();
});
