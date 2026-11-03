/* Wezzet MP3 encoder worker: turns raw PCM into MP3 with lamejs (LAME). */
importScripts("/vendor/lamejs-1.2.7.min.js");
self.onmessage = (e) => {
  const { left, right, rate, kbps } = e.data;
  const toInt = (f) => {
    const out = new Int16Array(f.length);
    for (let i = 0; i < f.length; i++) { const s = Math.max(-1, Math.min(1, f[i])); out[i] = s < 0 ? s * 0x8000 : s * 0x7fff; }
    return out;
  };
  const L = toInt(left), R = right ? toInt(right) : null;
  const enc = new lamejs.Mp3Encoder(R ? 2 : 1, rate, kbps);
  const parts = [], step = 1152 * 20;
  let last = 0;
  for (let i = 0; i < L.length; i += step) {
    const buf = R ? enc.encodeBuffer(L.subarray(i, i + step), R.subarray(i, i + step)) : enc.encodeBuffer(L.subarray(i, i + step));
    if (buf.length) parts.push(new Uint8Array(buf));
    const p = Math.floor((i / L.length) * 100);
    if (p !== last) { last = p; self.postMessage({ progress: p }); }
  }
  const end = enc.flush();
  if (end.length) parts.push(new Uint8Array(end));
  self.postMessage({ blob: new Blob(parts, { type: "audio/mpeg" }) });
};
