// Background service worker — content script-ээс постууд ирэхэд API руу дамжуулна.
// Яагаад шууд content.js-ээс дуудахгүй вэ? facebook.com-ийн хамгаалалт (CSP, mixed content)
// http://127.0.0.1 руу хандахыг хаадаг. Background-аас бол host_permissions-оор зөвшөөрөгдөнө.
// Мөн хажуугийн самбарыг (sidepanel.html) нээж, сонгосон постыг storage.session-оор дамжуулна.

const DEFAULT_API = "http://127.0.0.1:8000";

// Extension-ий тэмдэг дээр дарахад popup биш, самбар нээгдэнэ
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

async function getApi() {
  const { api } = await chrome.storage.local.get("api");
  return api || DEFAULT_API;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "score") {
    (async () => {
      try {
        const res = await fetch(`${await getApi()}/score/posts`, {
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
  if (msg.type === "open-panel") {
    // sidePanel.open() зөвхөн хэрэглэгчийн дарсан үйлдлийн хариуд ажилладаг тул await-гүйгээр ШУУД дуудна
    const tab = sender.tab;
    chrome.sidePanel.open({ windowId: tab.windowId })
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    chrome.storage.session.set({ [`sel:${tab.id}`]: { ...msg.post, tabId: tab.id, at: Date.now() } });
    return true;
  }
  if (msg.type === "focus") {
    // Самбараас «Постод очих» → тухайн табын content script руу
    chrome.tabs.sendMessage(msg.tabId, { type: "focus", id: msg.id }).catch(() => {});
    return false;
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

// Таб хаагдвал сонголтыг цэвэрлэнэ
chrome.tabs.onRemoved.addListener((tabId) => { chrome.storage.session.remove(`sel:${tabId}`); });
