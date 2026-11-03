/* Home page tool search. Keywords cover the words people actually type. */
(() => {
  const TOOLS = [
    ["convert any file", "/convert", "convert any file format converter drop anything"],
    ["video and audio converter", "/video", "video audio mp4 mov mkv webm mp3 wav m4a ogg flac gif convert extract audio trim"],
    ["zip and unzip", "/zip", "zip unzip extract archive compress folder open zip file"],
    ["image converter", "/image", "heic jpg jpeg png webp avif gif bmp svg photo picture convert iphone resize compress"],
    ["compress image to a size", "/compress", "compress image reduce shrink kb mb file size smaller photo jpg heic under 100kb 200kb 1mb"],
    ["merge pdf and images to pdf", "/pdf", "pdf merge combine join jpg to pdf image to pdf photo to pdf"],
    ["split pdf and edit pages", "/split-pdf", "pdf split extract pages delete remove rotate separate cut"],
    ["pdf to jpg", "/pdf-to-jpg", "pdf to jpg png image picture convert pages export"],
    ["pdf to text", "/pdf-to-text", "pdf to text txt extract copy text from pdf words convert"],
    ["video and audio to mp3", "/mp3", "mp3 video to mp3 mp4 to mp3 audio converter extract sound music mov webm m4a wav ogg flac convert"],
    ["csv, json, excel and yaml converter", "/data", "csv json yaml yml tsv xlsx xls excel to csv excel to json csv to excel convert data spreadsheet table"],
    ["favicon generator", "/favicon", "favicon ico icon png to ico website app icon apple touch"],
    ["embroidery file converter", "/embroidery", "embroidery pes dst jef exp vp3 xxx hus machine sewing stitch brother janome"],
    ["qr code generator", "/qr", "qr code wifi link barcode scan"],
    ["word counter", "/words", "word count character count letters essay reading time"],
    ["case converter", "/case", "uppercase lowercase title case sentence camelcase snake case capitalize text"],
    ["password generator", "/password", "password random secure strong generate"],
    ["paste bin", "/paste", "paste bin pastebin share text notes link save text clipboard online notepad memory"],
    ["web page to text", "/read", "web page to text url to text markdown reader view extract text from website scrape article clean"],
    ["calculator", "/calc", "calculator calc math percent time zone convert units date days until days between sqrt"],
    ["json formatter", "/json", "json format validate beautify minify pretty print"],
    ["percentage calculator", "/percent", "percent percentage increase decrease discount math"],
    ["age calculator", "/age", "age birthday how old date difference days between dates"],
    ["tip calculator", "/tip", "tip bill split restaurant gratuity"],
    ["unit converter", "/units", "units convert length weight temperature celsius fahrenheit kg lbs miles km inches cm cups"],
    ["quilt fabric calculator", "/quilt", "quilt backing binding batting fabric yardage sewing"],
    ["timer and stopwatch", "/timer", "timer stopwatch countdown alarm clock minutes"],
    ["random picker", "/random", "random number generator name picker coin flip shuffle list"],
    ["color picker", "/color", "color colour hex rgb hsl picker contrast"],
    ["tumbler template maker", "/tumbler", "tumbler sublimation cup wrap template tapered skinny"],
    ["domain name checker", "/domains", "domain name available website whois com"],
    ["resize image", "/resize", "resize image photo picture width height pixels percent scale smaller bigger dimensions"],
    ["remove background", "/remove-bg", "remove background bg transparent png cutout cut out erase background photo person product"],
    ["compress pdf", "/compress-pdf", "compress pdf reduce shrink smaller pdf size mb kb email"],
    ["rotate pdf", "/rotate-pdf", "rotate pdf turn pages sideways upside down landscape portrait"],
    ["sign pdf", "/sign-pdf", "sign pdf signature esign e-sign fill sign document draw type name"],
    ["video to gif", "/gif", "gif video to gif mp4 to gif mov webm animated gif maker clip"],
    ["heic to jpg", "/heic-to-jpg", "heic to jpg jpeg iphone photo convert heif"],
    ["heic to png", "/heic-to-png", "heic to png iphone photo convert heif"],
    ["webp to png", "/webp-to-png", "webp to png convert image"],
    ["webp to jpg", "/webp-to-jpg", "webp to jpg jpeg convert image"],
    ["png to jpg", "/png-to-jpg", "png to jpg jpeg convert image"],
    ["jpg to png", "/jpg-to-png", "jpg jpeg to png convert image"],
    ["png to webp", "/png-to-webp", "png to webp convert image website"],
    ["jpg to pdf", "/jpg-to-pdf", "jpg to pdf jpeg png photo image to pdf combine"],
    ["mov to mp3", "/mov-to-mp3", "mov to mp3 iphone video audio extract quicktime"],
    ["mp4 to mp3", "/mp4-to-mp3", "mp4 to mp3 video audio extract"],
    ["wav to mp3", "/wav-to-mp3", "wav to mp3 audio convert"],
    ["m4a to mp3", "/m4a-to-mp3", "m4a to mp3 voice memo audio convert itunes"],
    ["pes to dst", "/pes-to-dst", "pes to dst embroidery brother tajima convert"],
    ["dst to pes", "/dst-to-pes", "dst to pes embroidery brother tajima convert"],
    ["pes to jef", "/pes-to-jef", "pes to jef embroidery janome brother convert"],
    ["jef to pes", "/jef-to-pes", "jef to pes embroidery janome brother convert"],
    ["dst to jef", "/dst-to-jef", "dst to jef embroidery janome tajima convert"],
    ["forum", "/forum", "forum community discuss questions talk"],
    ["mov to mp4", "/mov-to-mp4", "video audio convert mov to mp4"],
    ["mkv to mp4", "/mkv-to-mp4", "video audio convert mkv to mp4"],
    ["avi to mp4", "/avi-to-mp4", "video audio convert avi to mp4"],
    ["webm to mp4", "/webm-to-mp4", "video audio convert webm to mp4"],
    ["mp4 to webm", "/mp4-to-webm", "video audio convert mp4 to webm"],
    ["compress video", "/compress-video", "video audio convert compress video"],
    ["mp4 to wav", "/mp4-to-wav", "video audio convert mp4 to wav"],
    ["mp3 to wav", "/mp3-to-wav", "video audio convert mp3 to wav"],
    ["flac to mp3", "/flac-to-mp3", "video audio convert flac to mp3"],
    ["ogg to mp3", "/ogg-to-mp3", "video audio convert ogg to mp3"],
    ["mp3 to m4a", "/mp3-to-m4a", "video audio convert mp3 to m4a"],
    ["wav to ogg", "/wav-to-ogg", "video audio convert wav to ogg"],
    ["trim video", "/trim-video", "video audio convert trim video"],
    ["avif to jpg", "/avif-to-jpg", "image photo convert avif to jpg"],
    ["avif to png", "/avif-to-png", "image photo convert avif to png"],
    ["gif to png", "/gif-to-png", "image photo convert gif to png"],
    ["bmp to jpg", "/bmp-to-jpg", "image photo convert bmp to jpg"],
    ["svg to png", "/svg-to-png", "image photo convert svg to png"],
    ["jpg to webp", "/jpg-to-webp", "image photo convert jpg to webp"],
    ["heic to webp", "/heic-to-webp", "image photo convert heic to webp"],
    ["people chat", "/chat", "people chat channels dm direct message voice call talk friends"],
    ["agent chat: board for ai agents", "/aicomms", "ai agent agents chat message board llm claude chatgpt mcp coordinate multi agent talk"],
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
      const li = document.createElement("li"); li.className = "none"; li.textContent = "no tool matches that yet.";
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

  // Recently used tools (saved by theme.js on each tool page)
  try {
    const rec = JSON.parse(localStorage.getItem("wz-recent") || "[]").filter((r) => r && /^\/[a-z0-9-]+$/.test(r.u)).slice(0, 4);
    const box = document.getElementById("recent");
    if (rec.length && box) {
      box.append("Recent: ");
      rec.forEach((r, i) => {
        const a = document.createElement("a"); a.href = r.u; a.textContent = r.n;
        if (i) box.append(" · ");
        box.append(a);
      });
      box.hidden = false;
    }
  } catch (e) {}

  // Support links like wezzet.com/?q=pdf
  const pre = new URLSearchParams(location.search).get("q");
  if (pre) { q.value = pre; render(); }
})();
