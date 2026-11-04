/* Wezzet extension: right-click menus that send a file, link or selected text to wezzet.com. */
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: "convert", title: "Convert with Wezzet", contexts: ["image", "video", "audio", "link"] });
  chrome.contextMenus.create({ id: "ask", title: "Ask WezzetAI about \"%s\"", contexts: ["selection"] });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId === "ask") return chrome.tabs.create({ url: "https://wezzet.com/ai?q=" + encodeURIComponent(info.selectionText.slice(0, 500)) });
  const src = info.srcUrl || info.linkUrl;
  // The file is fetched here and handed to the page by content.js, so it goes straight into Wezzet's converter in the tab.
  await chrome.storage.session.set({ pending: src });
  chrome.tabs.create({ url: "https://wezzet.com/convert?ext=1" });
});

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg !== "wezzet-pending") return;
  (async () => {
    const { pending } = await chrome.storage.session.get("pending");
    await chrome.storage.session.remove("pending");
    if (!pending) return reply(null);
    try {
      const r = await fetch(pending);
      const buf = await r.arrayBuffer();
      const name = decodeURIComponent(new URL(pending).pathname.split("/").pop() || "file") || "file";
      reply({ name, type: r.headers.get("content-type") || "", data: Array.from(new Uint8Array(buf)) });
    } catch (e) { reply({ error: "Couldn't download that file. Save it first, then drop it on Wezzet." }); }
  })();
  return true;
});
