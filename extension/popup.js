// Popup — сервер ажиллаж байгаа эсэхийг харуулж, API хаягийг солих боломж өгнө
const st = document.getElementById("st");
const input = document.getElementById("api");

chrome.storage.local.get("api").then(({ api }) => { input.value = api || "http://127.0.0.1:8000"; });

function check() {
  chrome.runtime.sendMessage({ type: "health" }, (r) => {
    if (r && r.ok) { st.textContent = `✅ Сервер ажиллаж байна (${r.model})`; st.className = "st ok"; }
    else { st.textContent = "❌ Сервер асаагүй байна — uvicorn-оо ажиллуулна уу"; st.className = "st bad"; }
  });
}

document.getElementById("save").addEventListener("click", async () => {
  await chrome.storage.local.set({ api: input.value.trim().replace(/\/$/, "") });
  check();
});
check();
