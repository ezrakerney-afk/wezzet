/* Wezzet domain checker.
   Asks each registry directly over RDAP (the official replacement for WHOIS).
   If a registry can't be reached from the browser, falls back to a DNS lookup,
   which can tell "taken" for sure but only "probably available". */
(() => {
  const TLDS = ["com", "net", "org", "io", "co", "ai", "app", "dev", "xyz", "shop"];
  const KNOWN_RDAP = {
    com: "https://rdap.verisign.com/com/v1/",
    net: "https://rdap.verisign.com/net/v1/",
    org: "https://rdap.publicinterestregistry.org/rdap/",
    app: "https://pubapi.registry.google/rdap/",
    dev: "https://pubapi.registry.google/rdap/",
  };
  const VARIANTS = [(n) => "get" + n, (n) => "try" + n, (n) => "use" + n, (n) => n + "app", (n) => n + "hq", (n) => n + "hub"];

  const $ = (id) => document.getElementById(id);
  const form = $("domain-form"), input = $("domain-input"), list = $("results"), ideasBox = $("ideas"), ideasList = $("ideas-list"), msg = $("form-msg");

  let bootstrap = null;
  async function rdapBase(tld) {
    if (KNOWN_RDAP[tld]) return KNOWN_RDAP[tld];
    if (!bootstrap) {
      bootstrap = fetch("https://data.iana.org/rdap/dns.json")
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
    }
    const data = await bootstrap;
    if (data && data.services) {
      for (const [tlds, urls] of data.services) {
        if (tlds.includes(tld)) {
          const url = urls.find((u) => u.startsWith("https://")) || urls[0];
          return url.endsWith("/") ? url : url + "/";
        }
      }
    }
    // No registry listed (for example .io and .co): don't guess, use DNS instead.
    // Third-party RDAP redirectors answer 404 for unknown TLDs, which would
    // wrongly report taken names as available.
    return null;
  }

  function withTimeout(promise, ms) {
    return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
  }

  function readRdap(json) {
    const out = {};
    for (const ev of json.events || []) {
      if (ev.eventAction === "registration") out.registered = ev.eventDate;
      if (ev.eventAction === "expiration") out.expires = ev.eventDate;
    }
    for (const ent of json.entities || []) {
      if ((ent.roles || []).includes("registrar")) {
        const fn = (ent.vcardArray && ent.vcardArray[1] || []).find((x) => x[0] === "fn");
        if (fn) out.registrar = fn[3];
      }
    }
    return out;
  }

  async function viaRdap(domain, tld) {
    const base = await rdapBase(tld);
    if (!base) throw new Error("no rdap");
    const res = await withTimeout(fetch(base + "domain/" + domain, { headers: { accept: "application/rdap+json" } }), 9000);
    if (res.status === 404) return { state: "available", source: "registry" };
    if (res.ok) return { state: "taken", source: "registry", ...readRdap(await res.json()) };
    throw new Error("rdap " + res.status);
  }

  async function viaDns(domain) {
    const res = await withTimeout(fetch(`https://cloudflare-dns.com/dns-query?name=${domain}&type=NS`, { headers: { accept: "application/dns-json" } }), 8000);
    if (!res.ok) throw new Error("dns");
    const j = await res.json();
    if (j.Status === 3) return { state: "probably", source: "dns" };
    if (j.Status === 0) return { state: "taken", source: "dns" };
    throw new Error("dns status " + j.Status);
  }

  async function check(domain) {
    const tld = domain.split(".").pop();
    try { return await viaRdap(domain, tld); } catch (e) {}
    try { return await viaDns(domain); } catch (e) {}
    return { state: "unknown" };
  }

  function clean(raw) {
    let s = raw.trim().toLowerCase();
    s = s.replace(/^[a-z]+:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0];
    let wanted = null;
    const dot = s.indexOf(".");
    if (dot > -1) { wanted = s.slice(dot + 1); s = s.slice(0, dot); }
    s = s.replace(/\s+/g, "");
    return { name: s, wanted };
  }

  function validName(n) {
    return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(n);
  }

  const fmtDate = (d) => {
    const t = new Date(d);
    return isNaN(t) ? null : t.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  function buyLinks(domain) {
    const wrap = document.createElement("span");
    wrap.className = "buy";
    const links = [
      ["Namecheap", `https://www.namecheap.com/domains/registration/results/?domain=${domain}`],
      ["Porkbun", `https://porkbun.com/checkout/search?q=${domain}`],
      ["Cloudflare", "https://www.cloudflare.com/products/registrar/"],
    ];
    links.forEach(([label, href], i) => {
      const a = document.createElement("a");
      a.href = href; a.target = "_blank"; a.rel = "noopener nofollow";
      a.textContent = label;
      wrap.appendChild(a);
      if (i < links.length - 1) wrap.appendChild(document.createTextNode(", "));
    });
    return wrap;
  }

  const LABEL = { available: "Available", taken: "Taken", probably: "Probably available", unknown: "Couldn't check", checking: "Checking" };

  function renderRow(li, domain, r) {
    li.className = "row state-" + r.state;
    li.innerHTML = "";
    const name = document.createElement("span"); name.className = "name"; name.textContent = domain;
    const pill = document.createElement("span"); pill.className = "pill"; pill.textContent = LABEL[r.state];
    const detail = document.createElement("span"); detail.className = "detail";
    if (r.state === "taken" && (r.registered || r.registrar)) {
      const bits = [];
      if (r.registered && fmtDate(r.registered)) bits.push("Registered " + fmtDate(r.registered));
      if (r.expires && fmtDate(r.expires)) bits.push("renews " + fmtDate(r.expires));
      if (r.registrar) bits.push("at " + r.registrar);
      detail.textContent = bits.join(", ");
    } else if (r.state === "available" || r.state === "probably") {
      detail.appendChild(document.createTextNode("Register at "));
      detail.appendChild(buyLinks(domain));
    } else if (r.state === "unknown") {
      detail.textContent = "The registry didn't answer. Try again in a minute.";
    }
    li.append(name, pill, detail);
  }

  async function runIdeas(name) {
    ideasList.innerHTML = "";
    ideasBox.hidden = false;
    const tasks = VARIANTS.map((v) => v(name) + ".com").filter((d) => d.length <= 67).map(async (d) => {
      const li = document.createElement("li");
      ideasList.appendChild(li);
      renderRow(li, d, { state: "checking" });
      renderRow(li, d, await check(d));
    });
    await Promise.all(tasks);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.hidden = true;
    const { name, wanted } = clean(input.value);
    if (!name || !validName(name)) {
      msg.textContent = "Use letters, numbers and hyphens only (no spaces), up to 63 characters, and don't start or end with a hyphen.";
      msg.hidden = false;
      return;
    }
    const tlds = wanted && !TLDS.includes(wanted) && /^[a-z]{2,24}$/.test(wanted) ? [wanted, ...TLDS] : TLDS;
    if (wanted && TLDS.includes(wanted)) { tlds.splice(tlds.indexOf(wanted), 1); tlds.unshift(wanted); }
    list.innerHTML = "";
    ideasBox.hidden = true;
    $("results-wrap").hidden = false;
    const btn = form.querySelector("button");
    btn.disabled = true;
    const rows = tlds.map((t) => {
      const li = document.createElement("li");
      list.appendChild(li);
      renderRow(li, `${name}.${t}`, { state: "checking" });
      return [li, `${name}.${t}`];
    });
    const results = await Promise.all(rows.map(async ([li, d]) => { const r = await check(d); renderRow(li, d, r); return [d, r]; }));
    btn.disabled = false;
    const com = results.find(([d]) => d === `${name}.com`);
    if (com && com[1].state === "taken") runIdeas(name);
    try { history.replaceState(null, "", `?name=${encodeURIComponent(name)}`); } catch (e) {}
  });

  const pre = new URLSearchParams(location.search).get("name");
  if (pre) { input.value = pre; form.requestSubmit(); }
})();
