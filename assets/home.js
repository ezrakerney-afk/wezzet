/* Home page tool search. Keywords cover the words people actually type. */
(() => {
  const TOOLS = [
    ["Image converter", "/image", "heic jpg jpeg png webp avif gif bmp svg photo picture convert iphone resize compress"],
    ["Merge PDF and images to PDF", "/pdf", "pdf merge combine join jpg to pdf image to pdf photo to pdf"],
    ["Embroidery file converter", "/embroidery", "embroidery pes dst jef exp vp3 xxx hus machine sewing stitch brother janome"],
    ["QR code generator", "/qr", "qr code wifi link barcode scan"],
    ["Word counter", "/words", "word count character count letters essay reading time"],
    ["Case converter", "/case", "uppercase lowercase title case sentence camelcase snake case capitalize text"],
    ["Password generator", "/password", "password random secure strong generate"],
    ["JSON formatter", "/json", "json format validate beautify minify pretty print"],
    ["Percentage calculator", "/percent", "percent percentage increase decrease discount math"],
    ["Age calculator", "/age", "age birthday how old date difference days between dates"],
    ["Tip calculator", "/tip", "tip bill split restaurant gratuity"],
    ["Unit converter", "/units", "units convert length weight temperature celsius fahrenheit kg lbs miles km inches cm cups"],
    ["Quilt fabric calculator", "/quilt", "quilt backing binding batting fabric yardage sewing"],
    ["Timer and stopwatch", "/timer", "timer stopwatch countdown alarm clock minutes"],
    ["Random picker", "/random", "random number generator name picker coin flip shuffle list"],
    ["Color picker", "/color", "color colour hex rgb hsl picker contrast"],
    ["Tumbler template maker", "/tumbler", "tumbler sublimation cup wrap template tapered skinny"],
    ["Domain name checker", "/domains", "domain name available website whois com"],
    ["Forum", "/forum", "forum community discuss questions talk"],
  ].map(([name, url, kw]) => ({ name, url, name_l: name.toLowerCase(), hay: (name + " " + kw).toLowerCase() }));

  const q = document.getElementById("q"), list = document.getElementById("results"), form = document.getElementById("search-form");
  let shown = [], active = -1;

  function score(t, words) {
    let s = 0;
    for (const w of words) {
      if (!t.hay.includes(w)) return -1;
      if (t.name_l.startsWith(w)) s += 6;
      else if (new RegExp("\\b" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(t.name_l)) s += 4;
      else if (new RegExp("\\b" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(t.hay)) s += 2;
      else s += 1;
    }
    return s;
  }

  function render() {
    const words = q.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    shown = words.length
      ? TOOLS.map((t, i) => ({ t, s: score(t, words), i })).filter((x) => x.s >= 0).sort((a, b) => b.s - a.s || a.i - b.i).map((x) => x.t)
      : TOOLS.slice();
    active = words.length && shown.length ? 0 : -1;
    list.textContent = "";
    if (!shown.length) {
      const li = document.createElement("li"); li.className = "none"; li.textContent = "No tool matches that yet.";
      list.append(li);
    }
    shown.forEach((t, i) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = t.url; a.textContent = t.name; a.id = "opt-" + i; a.setAttribute("role", "option");
      a.setAttribute("aria-selected", i === active ? "true" : "false");
      a.tabIndex = -1;
      li.append(a); list.append(li);
    });
    open(true);
  }

  function open(on) {
    list.hidden = !on;
    q.setAttribute("aria-expanded", on ? "true" : "false");
    if (!on) q.removeAttribute("aria-activedescendant");
  }

  function move(d) {
    if (!shown.length) return;
    active = (active + d + shown.length) % shown.length;
    list.querySelectorAll("a").forEach((a, i) => a.setAttribute("aria-selected", i === active ? "true" : "false"));
    const el = document.getElementById("opt-" + active);
    q.setAttribute("aria-activedescendant", el.id);
    el.scrollIntoView({ block: "nearest" });
  }

  q.addEventListener("input", render);
  q.addEventListener("focus", render);
  q.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); if (list.hidden) render(); else move(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (e.key === "Escape") { open(false); }
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const t = shown[active >= 0 ? active : 0];
    if (t && (q.value.trim() || active >= 0)) location.href = t.url;
  });
  document.addEventListener("click", (e) => { if (!form.contains(e.target)) open(false); });

  // Support links like wezzet.com/?q=pdf
  const pre = new URLSearchParams(location.search).get("q");
  if (pre) { q.value = pre; render(); }
})();
