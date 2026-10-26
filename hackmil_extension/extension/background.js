// Background service worker — content script-ээс постууд ирэхэд API руу дамжуулна.
// Яагаад шууд content.js-ээс дуудахгүй вэ? facebook.com-ийн хамгаалалт (CSP, mixed content)
// http://127.0.0.1 руу хандахыг хаадаг. Background-аас бол host_permissions-оор зөвшөөрөгдөнө.

const DEFAULT_API = "http://127.0.0.1:8000";

async function getApi() {
  const { api } = await chrome.storage.local.get("api");
  return api || DEFAULT_API;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "score") {
    (async () => {
      try {
        const res = await fetch(`${await getApi()}/score`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: msg.items }),
        });
        sendResponse(await res.json());
      } catch (e) {
        sendResponse({ error: String(e) });   // сервер асаагүй бол энд орно
      }
    })();
    return true; // хариуг async-аар буцаана гэдгийг Chrome-д хэлнэ
  }
  if (msg.type === "feedback") {
    (async () => {
      try {
        const res = await fetch(`${await getApi()}/feedback`, {
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
