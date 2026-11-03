const $ = (id) => document.getElementById(id);
const t = $("t");
const seg = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;
function update() {
  const v = t.value;
  const words = (v.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) || []).length;
  const chars = seg ? [...seg.segment(v)].length : [...v].length;
  const noSpace = seg ? [...seg.segment(v.replace(/\s/g, ""))].length : [...v.replace(/\s/g, "")].length;
  const sentences = v.trim() ? (v.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) || []).filter((s) => /[\p{L}\p{N}]/u.test(s)).length : 0;
  const paras = v.split(/\n\s*\n/).filter((p) => p.trim()).length;
  const mins = words / 238;
  $("w").textContent = words.toLocaleString();
  $("c").textContent = chars.toLocaleString();
  $("cn").textContent = noSpace.toLocaleString();
  $("s").textContent = sentences.toLocaleString();
  $("p").textContent = paras.toLocaleString();
  $("rt").textContent = words === 0 ? "0 min" : mins < 1 ? `${Math.max(1, Math.round(mins * 60))} sec` : `${Math.round(mins)} min`;
}
t.addEventListener("input", update);
update();
