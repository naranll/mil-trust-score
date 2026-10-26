// Popup — серверийн төлөв, статистик, серверийн хаягийг солих
const st = document.getElementById("st"), stText = document.getElementById("st-text");
const input = document.getElementById("api");

chrome.storage.local.get("api").then(({ api }) => { input.value = api || "http://127.0.0.1:8000"; });

function check() {
  chrome.runtime.sendMessage({ type: "health" }, (r) => {
    if (r && r.ok) { stText.textContent = "Сервер ажиллаж байна"; st.title = r.model; st.className = "card status ok"; }
    else { stText.textContent = "Сервер асаагүй: uvicorn server:app --port 8000"; st.className = "card status bad"; }
  });
}

const SHAPES = {
  green:  '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.5" fill="var(--ok)"/></svg>',
  yellow: '<svg viewBox="0 0 16 16"><path d="M8 1.6l6.6 11.6H1.4z" fill="var(--warn)"/></svg>',
  red:    '<svg viewBox="0 0 16 16"><path d="M5.2 1.2h5.6l4 4v5.6l-4 4H5.2l-4-4V5.2z" fill="var(--stop)"/></svg>',
  ad:     '<svg viewBox="0 0 16 16"><path d="M1.5 4.2A1.7 1.7 0 0 1 3.2 2.5h6.1l5.2 5.5-5.2 5.5H3.2a1.7 1.7 0 0 1-1.7-1.7z" fill="var(--ad)"/></svg>',
};

async function showStats() {
  const { stats = {} } = await chrome.storage.local.get("stats");
  const g = (k) => stats[k] || 0;
  const ad = g("ad_scam") + g("ad_check") + g("ad_ok");
  const cell = (k, n, t) => `<div><b>${n}</b><span>${SHAPES[k]} ${t}</span></div>`;
  document.getElementById("stats").innerHTML =
    cell("green", g("green"), "Илрээгүй") + cell("yellow", g("yellow"), "Шалга") +
    cell("red", g("red"), "Дохиотой") + cell("ad", ad, "Зар");
  document.getElementById("stats-meta").textContent =
    `Алгассан: ${g("skip")}. Холбогдож чадаагүй: ${g("error")}.`;
}
document.getElementById("reset").addEventListener("click", async () => {
  await chrome.storage.local.remove("stats"); showStats();
});
document.getElementById("save").addEventListener("click", async () => {
  await chrome.storage.local.set({ api: input.value.trim().replace(/\/$/, "") });
  check();
});
showStats();
check();
