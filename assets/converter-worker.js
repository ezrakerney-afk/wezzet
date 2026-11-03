/* Wezzet embroidery converter engine.
   Runs pyembroidery (MIT) inside Pyodide (MPL-2.0) in a Web Worker,
   so files are read and converted entirely on the visitor's device. */

importScripts("/vendor/pyodide/pyodide.js");

const ENGINE = `
import os, json
import pyembroidery as pe

os.makedirs("/work", exist_ok=True)

HOOPS = [
    ("4 × 4 in", 100, 100),
    ("5 × 7 in", 130, 180),
    ("6 × 10 in", 160, 260),
    ("8 × 8 in", 200, 200),
    ("8 × 12 in", 200, 300),
    ("14 × 8 in", 360, 200),
]

PREVIEW_PALETTE = ["#1f3a93", "#c0392b", "#16825d", "#d4a017", "#7d3c98",
                   "#d35400", "#2c3e50", "#e84393", "#0e7c86", "#6d4c41"]

_designs = {}

def _hoop_for(w, h):
    for name, hw, hh in HOOPS:
        if (w <= hw and h <= hh) or (w <= hh and h <= hw):
            return name
    return None

def inspect_design(path):
    p = pe.read(path)
    if p is None or len(p.stitches) == 0:
        raise ValueError("unreadable")
    _designs[path] = p
    minx, miny, maxx, maxy = p.extents()
    w = (maxx - minx) / 10.0
    h = (maxy - miny) / 10.0
    stitch_count = sum(1 for s in p.stitches if s[2] == pe.STITCH)
    has_colors = len(p.threadlist) > 0
    blocks = []
    for i, (block, thread) in enumerate(p.get_as_colorblocks()):
        if has_colors and thread is not None:
            color = thread.hex_color()
            name = (thread.description or thread.catalog_number or "").strip()
        else:
            color = PREVIEW_PALETTE[i % len(PREVIEW_PALETTE)]
            name = ""
        lines, cur = [], []
        for x, y, cmd in block:
            if cmd == pe.STITCH:
                cur.append(round(x - minx, 1))
                cur.append(round(y - miny, 1))
            else:
                if len(cur) >= 4:
                    lines.append(cur)
                cur = []
        if len(cur) >= 4:
            lines.append(cur)
        if lines:
            blocks.append({"color": color, "name": name, "lines": lines})
    return json.dumps({
        "width_mm": round(w, 1),
        "height_mm": round(h, 1),
        "stitches": stitch_count,
        "colors": len(blocks),
        "has_colors": has_colors,
        "hoop": _hoop_for(w, h),
        "extent": [round(maxx - minx, 1), round(maxy - miny, 1)],
        "blocks": blocks,
    })

def convert_design(path, ext):
    p = _designs[path]
    out = "/work/out." + ext
    if os.path.exists(out):
        os.remove(out)
    pe.write(p, out)
    return out
`;

const ready = (async () => {
  const py = await loadPyodide({ indexURL: "/vendor/pyodide/" });
  const res = await fetch("/vendor/pyembroidery-1.5.1-py2.py3-none-any.whl");
  if (!res.ok) throw new Error("engine-download");
  py.unpackArchive(await res.arrayBuffer(), "wheel");
  py.runPython(ENGINE);
  return py;
})();

ready.then(
  () => postMessage({ type: "ready" }),
  () => postMessage({ type: "failed" })
);

onmessage = async (e) => {
  const msg = e.data;
  try {
    const py = await ready;
    if (msg.type === "inspect") {
      const ext = (msg.name.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `/work/in_${msg.id}.${ext}`;
      py.FS.writeFile(path, new Uint8Array(msg.bytes));
      const json = py.globals.get("inspect_design")(path);
      postMessage({ id: msg.id, ok: true, result: JSON.parse(json), path });
    } else if (msg.type === "convert") {
      const out = py.globals.get("convert_design")(msg.path, msg.ext);
      const bytes = py.FS.readFile(out);
      postMessage({ id: msg.id, ok: true, bytes }, [bytes.buffer]);
    }
  } catch (err) {
    postMessage({ id: msg.id, ok: false, error: String((err && err.message) || err) });
  }
};
