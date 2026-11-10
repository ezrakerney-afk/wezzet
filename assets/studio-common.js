export const $ = id => document.getElementById(id);
export function save(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export function stamp(seconds, separator = ',') {
  const ms = Math.max(0, Math.round(seconds * 1000));
  return [Math.floor(ms / 3600000), Math.floor(ms / 60000) % 60, Math.floor(ms / 1000) % 60].map(n => String(n).padStart(2, '0')).join(':') + separator + String(ms % 1000).padStart(3, '0');
}
export function readCaptions(text) {
  let last = -1;
  return text.split('\n').filter(s => s.trim()).map((line, i) => {
    const parts = line.split('|'), start = Number(parts.shift()?.trim()), end = Number(parts.shift()?.trim()), text = parts.join('|').trim();
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || start < last || !text) throw new Error(`Check caption line ${i + 1}: start | end | text, with times in order and end after start.`);
    last = end; return { start, end, text };
  });
}
export function subtitles(cues, format) {
  const vtt = format === 'vtt';
  return (vtt ? 'WEBVTT\n\n' : '') + cues.map((c,i) => `${vtt ? '' : (i+1)+'\n'}${stamp(c.start,vtt?'.':',')} --> ${stamp(c.end,vtt?'.':',')}\n${c.text}\n`).join('\n');
}
