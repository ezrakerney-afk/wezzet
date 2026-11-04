/* Runs on wezzet.com: drops a file sent from the right-click menu into the page's file input. */
if (new URLSearchParams(location.search).has("ext")) {
  chrome.runtime.sendMessage("wezzet-pending", (f) => {
    if (!f) return;
    if (f.error) return alert(f.error);
    const input = document.querySelector("#files, #file, input[type=file]");
    if (!input) return;
    const dt = new DataTransfer();
    dt.items.add(new File([new Uint8Array(f.data)], f.name, { type: f.type }));
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
