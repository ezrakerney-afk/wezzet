async function copyText(text, btn) {
  try { await navigator.clipboard.writeText(text); }
  catch (e) { const t = document.createElement("textarea"); t.value = text; document.body.append(t); t.select(); document.execCommand("copy"); t.remove(); }
  if (btn) { const l = btn.textContent; btn.textContent = "Copied"; setTimeout(() => (btn.textContent = l), 1200); }
}

const t = document.getElementById("t");
const SMALL = new Set("a an and as at but by for in nor of on or so the to up yet vs via".split(" "));
const words = (s) => s.replace(/([a-z0-9])([A-Z])/g, "$1 $2").split(/[^\p{L}\p{N}]+/u).filter(Boolean);
const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
const fns = {
  upper: (s) => s.toUpperCase(),
  lower: (s) => s.toLowerCase(),
  title: (s) => s.toLowerCase().replace(/[\p{L}\p{N}][\p{L}\p{N}'’]*/gu, (w, i) => {
    const before = s.slice(0, i);
    const start = i === 0 || /[:.!?]\s*$/.test(before);
    return !start && SMALL.has(w) ? w : cap(w);
  }),
  sentence: (s) => s.toLowerCase().replace(/(^\s*|[.!?]\s+)(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(/\bi\b/g, "I"),
  camel: (s) => words(s).map((w, i) => (i ? cap(w) : w.toLowerCase())).join(""),
  snake: (s) => words(s).map((w) => w.toLowerCase()).join("_"),
  kebab: (s) => words(s).map((w) => w.toLowerCase()).join("-"),
};
document.querySelectorAll("[data-c]").forEach((b) => b.addEventListener("click", () => {
  const mode = b.dataset.c;
  if (["camel", "snake", "kebab"].includes(mode)) t.value = t.value.split("\n").map(fns[mode]).join("\n");
  else t.value = fns[mode](t.value);
}));
document.getElementById("copy").addEventListener("click", (e) => copyText(t.value, e.currentTarget));
