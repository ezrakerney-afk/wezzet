(() => {
  const $ = (id) => document.getElementById(id);
  const stat = (v, l) => `<div class="stat"><b style="font-size:1.05rem;overflow-wrap:anywhere">${v}</b><span>${l}</span></div>`;
  const rel = (ms) => {
    const s = Math.round((ms - Date.now()) / 1000), a = Math.abs(s);
    const [n, u] = a < 60 ? [a, "second"] : a < 3600 ? [a / 60, "minute"] : a < 86400 ? [a / 3600, "hour"] : a < 2629800 ? [a / 86400, "day"] : a < 31557600 ? [a / 2629800, "month"] : [a / 31557600, "year"];
    const r = Math.floor(n);
    return s === 0 ? "now" : `${s < 0 ? "" : "in "}${r} ${u}${r === 1 ? "" : "s"}${s < 0 ? " ago" : ""}`;
  };
  const tick = () => { $("now").textContent = Math.floor(Date.now() / 1000); };
  tick(); setInterval(tick, 1000);
  $("now").title = "Click to copy";
  $("now").style.cursor = "pointer";
  $("now").addEventListener("click", () => navigator.clipboard && navigator.clipboard.writeText($("now").textContent));

  function fromTs() {
    const raw = $("ts").value.trim().replace(/[,_\s]/g, "");
    if (!raw) { $("tsout").innerHTML = ""; return; }
    if (!/^-?\d+(\.\d+)?$/.test(raw)) { $("tsout").innerHTML = stat("Not a number", "Error"); return; }
    const digits = raw.replace(/^-/, "").split(".")[0].length;
    const [unit, div] = digits <= 11 ? ["seconds", 0.001] : digits <= 14 ? ["milliseconds", 1] : digits <= 17 ? ["microseconds", 1e3] : ["nanoseconds", 1e6];
    const ms = +raw / div;
    const d = new Date(ms);
    if (isNaN(d)) { $("tsout").innerHTML = stat("Out of range", "Error"); return; }
    $("tsout").innerHTML = stat(unit, "Read as") + stat(d.toLocaleString(undefined, { dateStyle: "full", timeStyle: "long" }), "Your time") +
      stat(d.toISOString().replace("T", " ").replace(".000Z", " UTC").replace("Z", " UTC"), "UTC") + stat(d.toISOString(), "ISO 8601") + stat(rel(ms), "Relative");
  }
  $("ts").addEventListener("input", fromTs);

  function fromDate() {
    const v = $("dt").value;
    if (!v) { $("dtout").innerHTML = ""; return; }
    const utc = document.querySelector('input[name="tz"]:checked').value === "utc";
    const ms = utc ? Date.parse(v + (v.length === 16 ? ":00" : "") + "Z") : new Date(v).getTime();
    if (isNaN(ms)) { $("dtout").innerHTML = ""; return; }
    $("dtout").innerHTML = stat(Math.floor(ms / 1000), "Seconds") + stat(ms, "Milliseconds") + stat(new Date(ms).toISOString(), "ISO 8601");
  }
  $("dt").addEventListener("input", fromDate);
  document.querySelectorAll('input[name="tz"]').forEach((r) => r.addEventListener("change", fromDate));
  const now = new Date(); now.setSeconds(0, 0);
  $("dt").value = new Date(now - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  fromDate();
})();
