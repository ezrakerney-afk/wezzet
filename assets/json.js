async function copyText(text, btn) {
  try { await navigator.clipboard.writeText(text); }
  catch (e) { const t = document.createElement("textarea"); t.value = text; document.body.append(t); t.select(); document.execCommand("copy"); t.remove(); }
  if (btn) { const l = btn.textContent; btn.textContent = "Copied"; setTimeout(() => (btn.textContent = l), 1200); }
}

const $ = (id) => document.getElementById(id);
const t = $("t"), msg = $("msg");
function show(text, bad) { msg.textContent = text; msg.className = "note" + (bad ? " error" : ""); msg.hidden = false; }
function parse() {
  try { return JSON.parse(t.value); }
  catch (e) {
    let where = "";
    const m = String(e.message).match(/position (\d+)/) ;
    const lc = String(e.message).match(/line (\d+) column (\d+)/);
    if (lc) where = ` (line ${lc[1]}, column ${lc[2]})`;
    else if (m) { const pos = +m[1], before = t.value.slice(0, pos), line = before.split("\n").length, col = pos - before.lastIndexOf("\n");
      where = ` (line ${line}, column ${col})`; t.focus(); t.setSelectionRange(pos, pos + 1); }
    show("Not valid JSON" + where + ": " + String(e.message).replace(/^JSON\.parse: /, ""), true);
    throw e;
  }
}
$("fmt").addEventListener("click", () => { try { const ind = $("indent").value; t.value = JSON.stringify(parse(), null, ind === "tab" ? "\t" : +ind); show("Valid JSON."); } catch (e) {} });
$("min").addEventListener("click", () => { try { t.value = JSON.stringify(parse()); show("Valid JSON."); } catch (e) {} });
$("copy").addEventListener("click", (e) => copyText(t.value, e.currentTarget));
