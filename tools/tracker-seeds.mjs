// Builds assets/tracker-seeds.json: crypto addresses the US government has publicly tied to North Korea.
// Sources: OFAC SDN list (entries under a DPRK program) and the 51 addresses in FBI PSA250226 (Bybit).
// Public data only. Run: node tools/tracker-seeds.mjs  (a weekly GitHub Action runs it too).
import fs from "node:fs";
const get = async (u) => { const r = await fetch(u, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (seed list refresh)" } }); if (!r.ok) throw new Error(u + " " + r.status); return r.text(); };
const parseCsv = (text) => text.split(/\r?\n/).filter(Boolean).map((line) => { const out = []; let cur = "", q = false; for (let i = 0; i < line.length; i++) { const c = line[i]; if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; } else if (c === '"') q = true; else if (c === ",") { out.push(cur.trim()); cur = ""; } else cur += c; } out.push(cur.trim()); return out; });
const CHAIN = { XBT: "btc", ETH: "eth", TRX: "tron", BSC: "bsc", ARB: "arb" };
const chainFor = (tick, addr) => tick === "USDT" || tick === "USDC" ? (addr.startsWith("0x") ? "eth" : /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(addr) ? "tron" : "") : CHAIN[tick] || "";

const [sdn, comments] = await Promise.all([get("https://www.treasury.gov/ofac/downloads/sdn.csv"), get("https://www.treasury.gov/ofac/downloads/sdn_comments.csv")]);
const extra = new Map(); for (const r of parseCsv(comments)) extra.set(r[0], (extra.get(r[0]) || "") + " " + (r[1] || ""));
const seen = new Set(), seeds = [];
const add = (chain, address, label, source, source_url) => { const k = chain + ":" + address.toLowerCase(); if (!chain || seen.has(k)) return; seen.add(k); seeds.push({ chain, address, label, source, source_url }); };
for (const r of parseCsv(sdn)) {
  if (!/DPRK/.test(r[3] || "")) continue;
  const remarks = (r[11] || "") + " " + (extra.get(r[0]) || "");
  for (const m of remarks.matchAll(/Digital Currency Address - ([A-Z0-9]+) ([A-Za-z0-9]{20,100})/g)) add(chainFor(m[1], m[2]), m[2], r[1].slice(0, 80), "OFAC SDN (" + r[3] + ")", "https://sanctionssearch.ofac.treas.gov/Details.aspx?id=" + r[0]);
}
const ofac = seeds.length;
const psa = await get("https://www.ic3.gov/PSA/2025/PSA250226");
for (const a of new Set(psa.match(/0x[0-9a-fA-F]{40}/g) || [])) add("eth", a, "Bybit theft (TraderTraitor)", "FBI PSA250226", "https://www.ic3.gov/PSA/2025/PSA250226");
if (ofac < 20 || seeds.length - ofac < 40) throw new Error("Too few addresses found (" + ofac + " OFAC, " + (seeds.length - ofac) + " FBI): a source changed format, keeping the old file.");
const old = fs.existsSync("assets/tracker-seeds.json") ? JSON.parse(fs.readFileSync("assets/tracker-seeds.json", "utf8")) : null;
if (old && JSON.stringify(old.seeds) === JSON.stringify(seeds)) { console.log("No change (" + seeds.length + ")"); process.exit(0); }
fs.writeFileSync("assets/tracker-seeds.json", JSON.stringify({ updated: new Date().toISOString().slice(0, 10), seeds }, null, 0) + "\n");
console.log("Wrote " + seeds.length + " seeds (" + ofac + " OFAC DPRK, " + (seeds.length - ofac) + " FBI)");
