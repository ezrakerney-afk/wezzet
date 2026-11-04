/* Wezzet cryptography tools: hashes, HMAC, AES encryption, classical ciphers, encodings, JWT decoding and key
   generation. Everything runs in this browser with the Web Crypto API; nothing is sent or stored. */
(() => {
  const app = document.getElementById("app"), d = app.dataset;
  const el = (tag, props = {}, kids = []) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids); return n; };
  let uid = 0;
  const field = (label, input) => { input.id = "k" + uid++; return el("div", { className: "field" }, [el("label", { htmlFor: input.id, textContent: label }), input]); };
  const area = (ph = "", ro = false) => el("textarea", { className: "big", rows: 5, placeholder: ph, spellcheck: false, readOnly: ro });
  const txt = (v = "", ph = "") => el("input", { type: "text", value: v, placeholder: ph, spellcheck: false, autocomplete: "off" });
  const sel = (opts, v) => { const s = el("select"); opts.forEach(([val, t]) => s.add(new Option(t, val))); if (v !== undefined) s.value = v; return s; };
  const btn = (t, quiet) => el("button", { type: "button", className: "btn" + (quiet ? " btn-quiet" : ""), textContent: t });
  const row = (...f) => el("div", { className: "field-row " + (f.length >= 3 ? "three" : "two") }, f);
  const note = () => el("p", { className: "note", role: "status" });
  const enc = new TextEncoder(), dec = new TextDecoder();
  const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
  const unhex = (s) => { s = s.replace(/[\s:]/g, ""); if (!/^([0-9a-f]{2})*$/i.test(s)) throw new Error("not hex"); return Uint8Array.from(s.match(/../g) || [], (x) => parseInt(x, 16)); };
  const b64 = (b) => { let s = ""; new Uint8Array(b).forEach((x) => (s += String.fromCharCode(x))); return btoa(s); };
  const unb64 = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, "") + "===".slice((s.replace(/\s/g, "").length + 3) % 4)), (c) => c.charCodeAt(0));
  const b64url = (b) => b64(b).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const copyBtn = (src) => { const b = btn("Copy", true); b.onclick = () => navigator.clipboard?.writeText(src.value).then(() => { b.textContent = "Copied"; setTimeout(() => (b.textContent = "Copy"), 1200); }); return b; };

  // MD5 (not in Web Crypto). RFC 1321.
  function md5(bytes) {
    const K = Array.from({ length: 64 }, (_, i) => (Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);
    const S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
    const n = bytes.length, len = (((n + 8) >> 6) + 1) << 6, m = new Uint8Array(len); m.set(bytes); m[n] = 0x80;
    const dv = new DataView(m.buffer); dv.setUint32(len - 8, (n * 8) >>> 0, true); dv.setUint32(len - 4, Math.floor(n / 2 ** 29), true);
    let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    for (let o = 0; o < len; o += 64) {
      let A = a0, B = b0, C = c0, D = d0;
      for (let i = 0; i < 64; i++) {
        let F, g;
        if (i < 16) { F = (B & C) | (~B & D); g = i; } else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; } else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; } else { F = C ^ (B | ~D); g = (7 * i) % 16; }
        F = (F + A + K[i] + dv.getUint32(o + g * 4, true)) >>> 0; A = D; D = C; C = B;
        const s = S[(i >> 4) * 4 + (i & 3)]; B = (B + ((F << s) | (F >>> (32 - s)))) >>> 0;
      }
      a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
    }
    const r = new DataView(new ArrayBuffer(16)); [a0, b0, c0, d0].forEach((x, i) => r.setUint32(i * 4, x, true)); return r.buffer;
  }
  function crc32(bytes) { let c, crc = 0xffffffff; for (const b of bytes) { c = (crc ^ b) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, "0"); }
  const HASHES = [["MD5", (b) => hex(md5(b))], ["SHA-1", null], ["SHA-256", null], ["SHA-384", null], ["SHA-512", null], ["CRC32", crc32]];
  const digest = async (name, b) => { const h = HASHES.find((x) => x[0] === name); return h[1] ? h[1](b) : hex(await crypto.subtle.digest(name, b)); };

  // Base32 (RFC 4648) and Base58 (Bitcoin alphabet)
  const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const b32 = (u) => { let bits = 0, v = 0, s = ""; for (const x of u) { v = (v << 8) | x; bits += 8; while (bits >= 5) { s += B32[(v >>> (bits - 5)) & 31]; bits -= 5; } } if (bits) s += B32[(v << (5 - bits)) & 31]; return s + "=".repeat((8 - (s.length % 8)) % 8); };
  const unb32 = (s) => { s = s.toUpperCase().replace(/[=\s]/g, ""); let bits = 0, v = 0; const o = []; for (const c of s) { const i = B32.indexOf(c); if (i < 0) throw new Error("bad"); v = (v << 5) | i; bits += 5; if (bits >= 8) { o.push((v >>> (bits - 8)) & 255); bits -= 8; } } return Uint8Array.from(o); };
  const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const b58 = (u) => { let n = 0n; for (const x of u) n = n * 256n + BigInt(x); let s = ""; while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; } for (const x of u) { if (x) break; s = "1" + s; } return s; };
  const unb58 = (s) => { let n = 0n; for (const c of s.trim()) { const i = B58.indexOf(c); if (i < 0) throw new Error("bad"); n = n * 58n + BigInt(i); } const o = []; while (n > 0n) { o.unshift(Number(n % 256n)); n /= 256n; } for (const c of s.trim()) { if (c !== "1") break; o.unshift(0); } return Uint8Array.from(o); };

  // Classical ciphers
  const shift = (s, k) => s.replace(/[a-z]/gi, (c) => { const a = c <= "Z" ? 65 : 97; return String.fromCharCode(((c.charCodeAt(0) - a + (k % 26) + 26) % 26) + a); });
  const vig = (s, key, dir) => { const k = key.toUpperCase().replace(/[^A-Z]/g, ""); if (!k) return s; let j = 0; return s.replace(/[a-z]/gi, (c) => shift(c, dir * (k.charCodeAt(j++ % k.length) - 65))); };
  const atbash = (s) => s.replace(/[a-z]/gi, (c) => { const a = c <= "Z" ? 65 : 97; return String.fromCharCode(25 - (c.charCodeAt(0) - a) + a); });
  const rot47 = (s) => s.replace(/[!-~]/g, (c) => String.fromCharCode(33 + ((c.charCodeAt(0) - 33 + 47) % 94)));
  const railFence = (s, n, dir) => {
    n = Math.max(2, n | 0); const L = [...s], cyc = 2 * n - 2, rows = L.map((_, i) => { const p = i % cyc; return p < n ? p : cyc - p; });
    const order = L.map((_, i) => i).sort((a, b) => rows[a] - rows[b] || a - b);
    if (dir > 0) return order.map((i) => L[i]).join("");
    const o = []; order.forEach((pos, k) => (o[pos] = L[k])); return o.join("");
  };
  const affine = (s, a, b, dir) => { const inv = [...Array(26).keys()].find((x) => (a * x) % 26 === 1); if (inv === undefined) throw new Error("a must be coprime with 26 (1, 3, 5, 7, 9, 11, 15, 17, 19, 21, 23, 25)"); return s.replace(/[a-z]/gi, (c) => { const z = c <= "Z" ? 65 : 97, x = c.charCodeAt(0) - z; return String.fromCharCode((dir > 0 ? (a * x + b) % 26 : (((inv * (x - b)) % 26) + 26) % 26) + z); }); };

  const TABS = {
    hash: ["Hash text", () => {
      const t = area("Type or paste text"), alg = sel(HASHES.map(([n]) => [n, n]), d.alg || "SHA-256"), fmt = sel([["hex", "Hex"], ["HEX", "HEX (upper case)"], ["b64", "Base64"]], "hex"), o = txt(), all = el("table", { className: "plain" }, [el("tbody")]);
      const go = async () => {
        const b = enc.encode(t.value), f = (h) => (fmt.value === "HEX" ? h.toUpperCase() : fmt.value === "b64" ? b64(unhex(h)) : h);
        o.value = f(await digest(alg.value, b)); const tb = all.tBodies[0]; tb.textContent = "";
        for (const [n] of HASHES) { const tr = el("tr"); tr.append(el("td", { textContent: n }), el("td", { textContent: f(await digest(n, b)), style: "font-weight:400;word-break:break-all;white-space:normal;font-family:ui-monospace,monospace" })); tb.append(tr); }
      };
      t.oninput = alg.onchange = fmt.onchange = go; go();
      return [field("Text", t), row(field("Algorithm", alg), field("Output", fmt)), field("Hash", o), el("div", { className: "row-actions" }, [copyBtn(o)]), all];
    }],
    file: ["Hash a file", () => {
      const inp = el("input", { type: "file" }), alg = sel(HASHES.filter((h) => h[0] !== "CRC32" || true).map(([n]) => [n, n]), d.alg || "SHA-256"), o = txt(), cmp = txt("", "Paste a checksum to compare"), n = note();
      let file = null;
      const go = async () => { if (!file) return; n.textContent = "Hashing…"; const b = new Uint8Array(await file.arrayBuffer()); o.value = await digest(alg.value, b); const c = cmp.value.trim().toLowerCase(); n.textContent = c ? (c === o.value ? "✓ Match: the checksums are the same." : "✗ No match: the file differs from that checksum.") : `${file.name}, ${b.length.toLocaleString()} bytes`; };
      inp.onchange = () => { file = inp.files[0]; go(); }; alg.onchange = cmp.oninput = go;
      return [field("File", inp), row(field("Algorithm", alg), field("Compare with", cmp)), field("Checksum", o), n];
    }],
    hmac: ["HMAC", () => {
      const t = area("Message"), key = txt("", "Secret key"), alg = sel([["SHA-256", "HMAC-SHA256"], ["SHA-1", "HMAC-SHA1"], ["SHA-384", "HMAC-SHA384"], ["SHA-512", "HMAC-SHA512"]], "SHA-256"), o = txt(), o64 = txt();
      const go = async () => { if (!key.value) { o.value = o64.value = ""; return; } const k = await crypto.subtle.importKey("raw", enc.encode(key.value), { name: "HMAC", hash: alg.value }, false, ["sign"]); const s = await crypto.subtle.sign("HMAC", k, enc.encode(t.value)); o.value = hex(s); o64.value = b64(s); };
      t.oninput = key.oninput = alg.onchange = go;
      return [field("Message", t), row(field("Key", key), field("Algorithm", alg)), field("HMAC (hex)", o), field("HMAC (Base64)", o64), el("div", { className: "row-actions" }, [copyBtn(o)])];
    }],
    aes: ["AES encrypt / decrypt", () => {
      const t = area("Secret message, or the encrypted text to decrypt"), pw = el("input", { type: "password", placeholder: "Password", autocomplete: "new-password" }), o = area("", true), n = note();
      const e1 = btn("Encrypt"), d1 = btn("Decrypt", true);
      const keyFrom = async (salt) => crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" }, await crypto.subtle.importKey("raw", enc.encode(pw.value), "PBKDF2", false, ["deriveKey"]), { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
      e1.onclick = async () => { if (!pw.value) { n.textContent = "Enter a password first."; return; } const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12)); const c = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await keyFrom(salt), enc.encode(t.value))); const all = new Uint8Array(28 + c.length); all.set(salt); all.set(iv, 16); all.set(c, 28); o.value = b64(all); n.textContent = "Encrypted with AES-256-GCM. The key comes from your password (PBKDF2-SHA256, 250,000 rounds). Anyone with the password can decrypt it here."; };
      d1.onclick = async () => { try { const all = unb64(t.value.trim()); const p = await crypto.subtle.decrypt({ name: "AES-GCM", iv: all.slice(16, 28) }, await keyFrom(all.slice(0, 16)), all.slice(28)); o.value = dec.decode(p); n.textContent = "Decrypted."; } catch (e) { n.textContent = "Couldn't decrypt: wrong password, or the text isn't from this tool."; } };
      return [field("Text", t), field("Password", pw), el("div", { className: "row-actions" }, [e1, d1, copyBtn(o)]), field("Result", o), n];
    }],
    caesar: ["Classic ciphers", () => {
      const t = area("Hello, World"), c = sel([["caesar", "Caesar shift"], ["rot13", "ROT13"], ["rot47", "ROT47"], ["atbash", "Atbash"], ["vigenere", "Vigenère"], ["affine", "Affine"], ["rail", "Rail fence"], ["xor", "XOR (hex out)"]], d.cipher || "caesar");
      const key = txt("3", "Key / shift"), dir = sel([["1", "Encrypt"], ["-1", "Decrypt"]], "1"), o = area("", true), n = note();
      const hint = { caesar: "Shift (number)", vigenere: "Keyword", affine: "a,b (for example 5,8)", rail: "Number of rails", xor: "Key (text)" };
      const go = () => {
        n.textContent = ""; const k = key.value, D = +dir.value, s = t.value;
        key.parentNode.hidden = !hint[c.value]; key.previousSibling && (key.parentNode.querySelector("label").textContent = hint[c.value] || "Key");
        try {
          o.value = ({
            caesar: () => shift(s, D * (parseInt(k) || 0)), rot13: () => shift(s, 13), rot47: () => rot47(s), atbash: () => atbash(s), vigenere: () => vig(s, k, D),
            affine: () => { const [a, b] = k.split(/[ ,]+/).map(Number); return affine(s, a || 1, b || 0, D); }, rail: () => railFence(s, parseInt(k) || 2, D),
            xor: () => { const kb = enc.encode(k || "\0"); if (D > 0) return hex(enc.encode(s).map((x, i) => x ^ kb[i % kb.length])); return dec.decode(unhex(s).map((x, i) => x ^ kb[i % kb.length])); },
          })[c.value]();
        } catch (e) { o.value = ""; n.textContent = e.message === "not hex" ? "To decrypt XOR, paste the hex output." : e.message; }
        if (c.value === "caesar" && D > 0) n.textContent = "All 25 shifts: " + Array.from({ length: 25 }, (_, i) => `${i + 1}: ${shift(s.slice(0, 24), i + 1)}`).join("   ");
      };
      if (c.value === "vigenere") key.value = "KEY"; if (c.value === "affine") key.value = "5,8"; if (c.value === "rail") key.value = "3"; if (c.value === "xor") key.value = "secret";
      c.onchange = () => { key.value = { caesar: "3", vigenere: "KEY", affine: "5,8", rail: "3", xor: "secret" }[c.value] || ""; go(); };
      t.oninput = key.oninput = dir.onchange = go; t.value = "Hello, World"; setTimeout(go);
      return [field("Text", t), row(field("Cipher", c), field("Direction", dir)), field("Key", key), field("Result", o), el("div", { className: "row-actions" }, [copyBtn(o)]), n];
    }],
    encode: ["Encode / decode", () => {
      const t = area("Text"), f = sel([["b64", "Base64"], ["b64url", "Base64 URL-safe"], ["b32", "Base32"], ["b58", "Base58"], ["hex", "Hex"], ["url", "URL encoding"], ["html", "HTML entities"]], d.format || "b64"), o = area("Encoded"), n = note();
      const E = { b64: (s) => b64(enc.encode(s)), b64url: (s) => b64url(enc.encode(s)), b32: (s) => b32(enc.encode(s)), b58: (s) => b58(enc.encode(s)), hex: (s) => hex(enc.encode(s)), url: encodeURIComponent, html: (s) => s.replace(/[ -￿<>&"']/g, (c) => `&#${c.charCodeAt(0)};`) };
      const Dd = { b64: (s) => dec.decode(unb64(s)), b64url: (s) => dec.decode(unb64(s)), b32: (s) => dec.decode(unb32(s)), b58: (s) => dec.decode(unb58(s)), hex: (s) => dec.decode(unhex(s)), url: decodeURIComponent, html: (s) => { const x = document.createElement("textarea"); x.innerHTML = s; return x.value; } };
      const go = () => { n.textContent = ""; o.value = E[f.value](t.value); };
      o.oninput = () => { try { t.value = Dd[f.value](o.value.trim()); n.textContent = ""; } catch (e) { n.textContent = "That isn't valid " + f.selectedOptions[0].text + "."; } };
      t.oninput = f.onchange = go;
      return [field("Text", t), field("Format", f), field("Encoded (type here to decode)", o), n];
    }],
    jwt: ["JWT decoder", () => {
      const t = area("eyJhbGciOi…"), h = area("", true), p = area("", true), n = note();
      t.oninput = () => {
        const parts = t.value.trim().split("."); h.value = p.value = ""; n.textContent = "";
        if (!t.value.trim()) return;
        try {
          const j = (s) => JSON.parse(dec.decode(unb64(s))); const H = j(parts[0]), P = j(parts[1]);
          h.value = JSON.stringify(H, null, 2); p.value = JSON.stringify(P, null, 2);
          const when = (k) => (P[k] ? `${k}: ${new Date(P[k] * 1000).toLocaleString()}` : ""); const exp = P.exp && P.exp * 1000 < Date.now();
          n.textContent = [when("iat"), when("nbf"), when("exp"), exp ? "This token has expired." : "", "The signature isn't checked: decoding only reads the token."].filter(Boolean).join(" · ");
        } catch (e) { n.textContent = "That isn't a valid JWT (three Base64URL parts separated by dots)."; }
      };
      return [field("Token", t), row(field("Header", h), field("Payload", p)), n];
    }],
    keys: ["Keys and random", () => {
      const kind = sel([["rand", "Random bytes"], ["uuid", "UUID v4"], ["aes", "AES-256 key"], ["rsa", "RSA-2048 key pair (PEM)"], ["rsa4", "RSA-4096 key pair (PEM)"], ["ec", "ECDSA P-256 key pair (PEM)"], ["ed", "Ed25519 key pair (PEM)"]], d.kind || "rand");
      const len = txt("32", "Bytes"), o = area("", true), n = note(), go = btn("Generate");
      const pem = (label, buf) => `-----BEGIN ${label}-----\n${b64(buf).match(/.{1,64}/g).join("\n")}\n-----END ${label}-----`;
      const pair = async (alg, use) => { const k = await crypto.subtle.generateKey(alg, true, use); return pem("PUBLIC KEY", await crypto.subtle.exportKey("spki", k.publicKey)) + "\n\n" + pem("PRIVATE KEY", await crypto.subtle.exportKey("pkcs8", k.privateKey)); };
      go.onclick = async () => {
        n.textContent = ""; len.parentNode.hidden = kind.value !== "rand";
        try {
          const rsa = (bits) => pair({ name: "RSASSA-PKCS1-v1_5", modulusLength: bits, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, ["sign", "verify"]);
          if (kind.value === "rsa4") n.textContent = "Working… 4096-bit keys can take a few seconds.";
          o.value = await ({
            rand: async () => { const b = crypto.getRandomValues(new Uint8Array(Math.min(65536, Math.max(1, parseInt(len.value) || 32)))); return `Hex:\n${hex(b)}\n\nBase64:\n${b64(b)}`; },
            uuid: async () => Array.from({ length: 10 }, () => crypto.randomUUID()).join("\n"),
            aes: async () => { const k = await crypto.subtle.exportKey("raw", await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"])); return `Hex:\n${hex(k)}\n\nBase64:\n${b64(k)}`; },
            rsa: () => rsa(2048), rsa4: () => rsa(4096),
            ec: () => pair({ name: "ECDSA", namedCurve: "P-256" }, ["sign", "verify"]),
            ed: () => pair({ name: "Ed25519" }, ["sign", "verify"]),
          })[kind.value]();
          n.textContent = "Made with your browser's secure random generator. Nothing leaves this page.";
        } catch (e) { n.textContent = "Your browser can't make that kind of key."; }
      };
      kind.onchange = () => go.onclick(); setTimeout(() => go.onclick());
      return [row(field("Type", kind), field("Length (bytes)", len)), el("div", { className: "row-actions" }, [go, copyBtn(o)]), field("Result", o), n];
    }],
  };

  const tabs = el("div", { className: "row-actions", role: "tablist" }), panel = el("div", { style: "display:grid;gap:16px;margin-top:16px" });
  const open = (k) => {
    panel.textContent = ""; panel.append(...TABS[k][1]());
    [...tabs.children].forEach((b) => { const on = b.dataset.k === k; b.className = "btn" + (on ? "" : " btn-quiet"); b.setAttribute("aria-selected", on); });
  };
  for (const k in TABS) { const b = btn(TABS[k][0], true); b.dataset.k = k; b.setAttribute("role", "tab"); b.onclick = () => { d.alg = d.cipher = d.format = d.kind = ""; open(k); }; tabs.append(b); }
  app.append(tabs, panel);
  open(TABS[d.mode] ? d.mode : "hash");
})();
