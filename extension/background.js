// Background service worker — content script-ээс постууд ирэхэд API руу дамжуулна.
// Яагаад шууд content.js-ээс дуудахгүй вэ? facebook.com-ийн хамгаалалт (CSP, mixed content)
// http://127.0.0.1 руу хандахыг хаадаг. Background-аас бол host_permissions-оор зөвшөөрөгдөнө.

const DEFAULT_API = "http://127.0.0.1:8000";

// Popup-д харуулах статистик: хэдэн пост шалгасан / алгассан / алдаа гарсан
async function countStats(results, failed = 0) {
  const { stats = { green: 0, yellow: 0, red: 0, skip: 0, error: 0 } } = await chrome.storage.local.get("stats");
  if (results) results.forEach((r) => { const k = r.status === "ok" ? r.zone : (r.status === "skip" ? "skip" : "error"); stats[k] = (stats[k] || 0) + 1; });
  stats.error += failed;
  await chrome.storage.local.set({ stats });
}

async function getApi() {
  const { api } = await chrome.storage.local.get("api");
  return api || DEFAULT_API;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "score") {
    (async () => {
      try {
        const res = await fetch(`${await getApi()}/score/posts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: msg.items }),
        });
        const data = await res.json();
        await countStats(data.results || []);
        sendResponse(data);
      } catch (e) {
        await countStats(null, msg.items.length);
        sendResponse({ error: String(e) });   // сервер асаагүй бол энд орно
      }
    })();
    return true; // хариуг async-аар буцаана гэдгийг Chrome-д хэлнэ
  }
  if (msg.type === "feedback") {
    (async () => {
      try {
        const res = await fetch(`${await getApi()}/feedback/posts`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(msg.item),
        });
        sendResponse(await res.json());
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }
  if (msg.type === "health") {
    (async () => {
      try {
        const res = await fetch(`${await getApi()}/health`);
        sendResponse(await res.json());
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }
});
