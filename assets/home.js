/* Home page tool search. Keywords cover the words people actually type. */
(() => {
  const TOOLS = [
    ["age calculator", "/age", "age birthday how old date difference days between dates"],
    ["apple shortcut file viewer", "/shortcut-viewer", "apple shortcut file viewer shortcut viewer convert"],
    ["avi to mp4", "/avi-to-mp4", "video audio convert avi to mp4"],
    ["avif to jpg", "/avif-to-jpg", "image photo convert avif to jpg"],
    ["avif to png", "/avif-to-png", "image photo convert avif to png"],
    ["bmi calculator", "/bmi", "bmi calculator fun game test calculator"],
    ["bmp to jpg", "/bmp-to-jpg", "image photo convert bmp to jpg"],
    ["calculator", "/calc", "calculator calc math percent time zone convert units date days until days between sqrt"],
    ["case converter", "/case", "uppercase lowercase title case sentence camelcase snake case capitalize text"],
    ["click speed test", "/cps", "click speed test (cps) fun game test calculator"],
    ["color picker", "/color", "color colour hex rgb hsl picker contrast"],
    ["compress image to a size", "/compress", "compress image reduce shrink kb mb file size smaller photo jpg heic under 100kb 200kb 1mb"],
    ["compress pdf", "/compress-pdf", "compress pdf reduce shrink smaller pdf size mb kb email"],
    ["compress video", "/compress-video", "video audio convert compress video"],
    ["convert any file", "/convert", "convert any file format converter drop anything"],
    ["convert to base64", "/file-to-base64", "convert to base64 file to base64 convert"],
    ["countdown", "/countdown", "countdown to a date fun game test calculator"],
    ["csv to html table", "/csv-to-html-table", "csv to html table csv to html table convert"],
    ["csv to json", "/csv-to-json", "csv to json csv to json convert"],
    ["csv to markdown table", "/csv-to-markdown-table", "csv to markdown table csv to markdown table convert"],
    ["csv to sql inserts", "/csv-to-sql", "csv to sql inserts csv to sql convert"],
    ["csv to tsv", "/csv-to-tsv", "csv to tsv csv to tsv convert"],
    ["csv to vcard contacts", "/csv-to-vcf", "csv to vcard contacts csv to vcf convert"],
    ["csv to xml", "/csv-to-xml", "csv to xml csv to xml convert"],
    ["csv to yaml", "/csv-to-yaml", "csv to yaml csv to yaml convert"],
    ["csv, json, excel and yaml converter", "/data", "csv json yaml yml tsv xlsx xls excel to csv excel to json csv to excel convert data spreadsheet table"],
    ["domain name checker", "/domains", "domain name available website whois com"],
    ["dst to jef", "/dst-to-jef", "dst to jef embroidery janome tajima convert"],
    ["dst to pes", "/dst-to-pes", "dst to pes embroidery brother tajima convert"],
    ["email to plain text", "/eml-to-text", "email to plain text eml to text convert"],
    ["embroidery file converter", "/embroidery", "embroidery pes dst jef exp vp3 xxx hus machine sewing stitch brother janome"],
    ["favicon generator", "/favicon", "favicon ico icon png to ico website app icon apple touch"],
    ["feed to csv", "/rss-to-csv", "feed to csv rss to csv convert"],
    ["file checksum (sha-256)", "/file-checksum", "file checksum (sha-256) file checksum convert"],
    ["first table to csv", "/html-table-to-csv", "first table to csv html table to csv convert"],
    ["flac to mp3", "/flac-to-mp3", "video audio convert flac to mp3"],
    ["gif to png", "/gif-to-png", "image photo convert gif to png"],
    ["gpx to geojson", "/gpx-to-geojson", "gpx to geojson gpx to geojson convert"],
    ["gpx to kml", "/gpx-to-kml", "gpx to kml gpx to kml convert"],
    ["heic to jpg", "/heic-to-jpg", "heic to jpg jpeg iphone photo convert heif"],
    ["heic to png", "/heic-to-png", "heic to png iphone photo convert heif"],
    ["heic to webp", "/heic-to-webp", "image photo convert heic to webp"],
    ["hex dump", "/hex-viewer", "hex dump hex viewer convert"],
    ["html to markdown", "/html-to-markdown", "html to markdown html to markdown convert"],
    ["html to pdf", "/html-to-pdf", "html to pdf html to pdf convert"],
    ["html to text", "/html-to-text", "html to text html to text convert"],
    ["ics calendar to csv", "/ics-to-csv", "ics calendar to csv ics to csv convert"],
    ["image converter", "/image", "heic jpg jpeg png webp avif gif bmp svg photo picture convert iphone resize compress"],
    ["image to ascii art", "/image-to-ascii", "image to ascii art image to ascii convert"],
    ["image to grayscale png", "/image-to-grayscale", "image to grayscale png image to grayscale convert"],
    ["jef to pes", "/jef-to-pes", "jef to pes embroidery janome brother convert"],
    ["jpg to pdf", "/jpg-to-pdf", "jpg to pdf jpeg png photo image to pdf combine"],
    ["jpg to png", "/jpg-to-png", "jpg jpeg to png convert image"],
    ["jpg to webp", "/jpg-to-webp", "image photo convert jpg to webp"],
    ["json formatter", "/json", "json format validate beautify minify pretty print"],
    ["json lines to json", "/jsonl-to-json", "json lines to json jsonl to json convert"],
    ["json to .env", "/json-to-env", "json to .env json to env convert"],
    ["json to csv", "/json-to-csv", "json to csv json to csv convert"],
    ["json to typescript type", "/json-to-typescript", "json to typescript type json to typescript convert"],
    ["json to xml", "/json-to-xml", "json to xml json to xml convert"],
    ["json to yaml", "/json-to-yaml", "json to yaml json to yaml convert"],
    ["kml to csv of points", "/kml-to-csv", "kml to csv of points kml to csv convert"],
    ["kml to gpx", "/kml-to-gpx", "kml to gpx kml to gpx convert"],
    ["links/bookmarks to csv", "/extract-links", "links/bookmarks to csv extract links convert"],
    ["loan calculator", "/loan", "loan and mortgage calculator fun game test calculator"],
    ["lorem ipsum generator", "/lorem", "lorem ipsum generator fun game test calculator"],
    ["m4a to mp3", "/m4a-to-mp3", "m4a to mp3 voice memo audio convert itunes"],
    ["markdown to html", "/markdown-to-html", "markdown to html markdown to html convert"],
    ["markdown to pdf", "/markdown-to-pdf", "markdown to pdf markdown to pdf convert"],
    ["merge pdf and images to pdf", "/pdf", "pdf merge combine join jpg to pdf image to pdf photo to pdf"],
    ["minify css", "/minify-css", "minify css minify css convert"],
    ["minify json", "/minify-json", "minify json minify json convert"],
    ["mkv to mp4", "/mkv-to-mp4", "video audio convert mkv to mp4"],
    ["morse code translator", "/morse", "morse code translator fun game test calculator"],
    ["mov to mp3", "/mov-to-mp3", "mov to mp3 iphone video audio extract quicktime"],
    ["mov to mp4", "/mov-to-mp4", "video audio convert mov to mp4"],
    ["mp3 to m4a", "/mp3-to-m4a", "video audio convert mp3 to m4a"],
    ["mp3 to wav", "/mp3-to-wav", "video audio convert mp3 to wav"],
    ["mp4 to mp3", "/mp4-to-mp3", "mp4 to mp3 video audio extract"],
    ["mp4 to wav", "/mp4-to-wav", "video audio convert mp4 to wav"],
    ["mp4 to webm", "/mp4-to-webm", "video audio convert mp4 to webm"],
    ["ogg to mp3", "/ogg-to-mp3", "video audio convert ogg to mp3"],
    ["opml feeds to csv", "/opml-to-csv", "opml feeds to csv opml to csv convert"],
    ["password generator", "/password", "password random secure strong generate"],
    ["paste bin", "/paste", "paste bin pastebin share text notes link save text clipboard online notepad memory"],
    ["pdf to jpg", "/pdf-to-jpg", "pdf to jpg png image picture convert pages export"],
    ["pdf to text", "/pdf-to-text", "pdf to text txt extract copy text from pdf words convert"],
    ["percentage calculator", "/percent", "percent percentage increase decrease discount math"],
    ["pes to dst", "/pes-to-dst", "pes to dst embroidery brother tajima convert"],
    ["pes to jef", "/pes-to-jef", "pes to jef embroidery janome brother convert"],
    ["playlist to text list", "/m3u-to-text", "playlist to text list m3u to text convert"],
    ["png to ico", "/png-to-ico", "png to ico png to ico convert"],
    ["png to jpg", "/png-to-jpg", "png to jpg jpeg convert image"],
    ["png to webp", "/png-to-webp", "png to webp convert image website"],
    ["qr code generator", "/qr", "qr code wifi link barcode scan"],
    ["quilt fabric calculator", "/quilt", "quilt backing binding batting fabric yardage sewing"],
    ["random picker", "/random", "random number generator name picker coin flip shuffle list"],
    ["reaction time test", "/reaction", "reaction time test fun game test calculator"],
    ["remove background", "/remove-bg", "remove background bg transparent png cutout cut out erase background photo person product"],
    ["resize image", "/resize", "resize image photo picture width height pixels percent scale smaller bigger dimensions"],
    ["roll dice or flip a coin", "/dice", "dice roller and coin flip fun game test calculator"],
    ["roman numerals", "/roman", "roman numeral converter fun game test calculator"],
    ["rotate pdf", "/rotate-pdf", "rotate pdf turn pages sideways upside down landscape portrait"],
    ["rtf to plain text", "/rtf-to-text", "rtf to plain text rtf to text convert"],
    ["sha-1 checksum", "/sha1-checksum", "sha-1 checksum sha1 checksum convert"],
    ["sha-512 checksum", "/sha512-checksum", "sha-512 checksum sha512 checksum convert"],
    ["shortcut/plist to json", "/plist-to-json", "shortcut/plist to json plist to json convert"],
    ["sign pdf", "/sign-pdf", "sign pdf signature esign e-sign fill sign document draw type name"],
    ["sort lines a to z", "/sort-lines", "sort lines a to z sort lines convert"],
    ["spin the wheel", "/wheel", "spin the wheel fun game test calculator"],
    ["split pdf and edit pages", "/split-pdf", "pdf split extract pages delete remove rotate separate cut"],
    ["srt to vtt", "/srt-to-vtt", "srt to vtt srt to vtt convert"],
    ["subtitles to plain text", "/srt-to-text", "subtitles to plain text srt to text convert"],
    ["svg to jpg", "/svg-to-jpg", "svg to jpg svg to jpg convert"],
    ["svg to png", "/svg-to-png", "image photo convert svg to png"],
    ["text file to morse code", "/text-to-morse", "text file to morse code text to morse convert"],
    ["text to binary", "/binary", "text to binary converter fun game test calculator"],
    ["text to binary", "/text-to-binary", "text to binary text to binary convert"],
    ["text to braille", "/text-to-braille", "text to braille text to braille convert"],
    ["text to nato alphabet", "/nato-alphabet", "text to nato alphabet nato alphabet convert"],
    ["text to rot13", "/rot13", "text to rot13 rot13 convert"],
    ["text to word frequency csv", "/word-frequency", "text to word frequency csv word frequency convert"],
    ["text upside down", "/upside-down-text", "text upside down upside down text convert"],
    ["timer and stopwatch", "/timer", "timer stopwatch countdown alarm clock minutes"],
    ["tip calculator", "/tip", "tip bill split restaurant gratuity"],
    ["to data uri", "/file-to-data-uri", "to data uri file to data uri convert"],
    ["to gzip (.gz)", "/gzip-file", "to gzip (.gz) gzip file convert"],
    ["trim video", "/trim-video", "video audio convert trim video"],
    ["tsv to csv", "/tsv-to-csv", "tsv to csv tsv to csv convert"],
    ["tumbler template maker", "/tumbler", "tumbler sublimation cup wrap template tapered skinny"],
    ["txt to pdf", "/txt-to-pdf", "txt to pdf txt to pdf convert"],
    ["txt to word", "/txt-to-word", "txt to word txt to word convert"],
    ["typing speed test", "/typing", "typing speed test fun game test calculator"],
    ["unit converter", "/units", "units convert length weight temperature celsius fahrenheit kg lbs miles km inches cm cups"],
    ["url shortcut to webloc", "/url-to-webloc", "url shortcut to webloc url to webloc convert"],
    ["vcf to csv", "/vcf-to-csv", "vcf to csv vcf to csv convert"],
    ["video and audio converter", "/video", "video audio mp4 mov mkv webm mp3 wav m4a ogg flac gif convert extract audio trim"],
    ["video and audio to mp3", "/mp3", "mp3 video to mp3 mp4 to mp3 audio converter extract sound music mov webm m4a wav ogg flac convert"],
    ["video to gif", "/gif", "gif video to gif mp4 to gif mov webm animated gif maker clip"],
    ["vtt to srt", "/vtt-to-srt", "vtt to srt vtt to srt convert"],
    ["wav to mp3", "/wav-to-mp3", "wav to mp3 audio convert"],
    ["wav to ogg", "/wav-to-ogg", "video audio convert wav to ogg"],
    ["web page to text", "/read", "web page to text url to text markdown reader view extract text from website scrape article clean"],
    ["webm to mp4", "/webm-to-mp4", "video audio convert webm to mp4"],
    ["webp to jpg", "/webp-to-jpg", "webp to jpg jpeg convert image"],
    ["webp to png", "/webp-to-png", "webp to png convert image"],
    ["word counter", "/words", "word count character count letters essay reading time"],
    ["xml to json", "/xml-to-json", "xml to json xml to json convert"],
    ["zip and unzip", "/zip", "zip unzip extract archive compress folder open zip file"],
    ["forum", "/forum", "forum community discuss questions talk"],
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
