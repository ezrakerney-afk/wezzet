/* Wezzet background remover. Runs an open-source cutout model in the browser
   with Transformers.js; the model downloads once, photos never leave the device.
   Runs on the CPU (wasm); full-resolution images can require substantial device memory. */
const LIB = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.3";
const MODELS = {
  person: { id: "Xenova/modnet", dtype: "fp32", sigmoid: false, mb: 26 },
  any: { id: "onnx-community/ormbg-ONNX", dtype: "q8", sigmoid: false, mb: 44, clean: [90, 170] },
};
const MAX_PIXELS = 24000000; // Explicit limit: never silently downscale the output.

const $ = (id) => document.getElementById(id);
const drop = $("drop"), input = $("files"), list = $("list"), msg = $("msg");
const view = $("view"), viewImg = $("view-img"), viewDl = $("view-dl");
const kind = () => document.querySelector('input[name="kind"]:checked').value;
let lib = null, busy = false;
const loaded = {};

function loadLib() {
  if (!lib) lib = import(LIB).then((t) => { t.env.allowLocalModels = false; return t; });
  return lib;
}

async function loadModel(k, status) {
  if (!loaded[k]) {
    loaded[k] = (async () => {
      const t = await loadLib();
      const m = MODELS[k];
      const progress = (p) => { if (p.status === "progress" && p.file && /onnx/.test(p.file)) status(`Downloading the model, ${Math.round(p.progress || 0)}%`); };
      const model = await t.AutoModel.from_pretrained(m.id, { device: "wasm", dtype: m.dtype, progress_callback: progress });
      const processor = await t.AutoProcessor.from_pretrained(m.id);
      return { t, m, model, processor };
    })();
    loaded[k].catch(() => { delete loaded[k]; });
  }
  return loaded[k];
}

async function decode(file) {
  const extra = window.wzDecodeExtra && await wzDecodeExtra(file).catch(() => null);
  if (extra) file = extra;
  const bmp = await createImageBitmap(file);
  if (bmp.width * bmp.height > MAX_PIXELS || Math.max(bmp.width, bmp.height) > 12000) {
    bmp.close();
    throw new Error("Choose an image up to 24 megapixels and 12,000 pixels per side. This tool preserves the original dimensions.");
  }
  const c = document.createElement("canvas");
  c.width = bmp.width; c.height = bmp.height;
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c;
}

async function cutout(file, status) {
  const k = kind();
  status(`Loading the model (about ${MODELS[k].mb} MB, only the first time)`);
  const { t, m, model, processor } = await loadModel(k, status);
  status("Removing the background");
  const c = await decode(file);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  const px = ctx.getImageData(0, 0, c.width, c.height);
  const image = new t.RawImage(px.data, c.width, c.height, 4);
  const { pixel_values } = await processor(image.rgb());
  const name = (model.sessions && model.sessions.model && model.sessions.model.inputNames && model.sessions.model.inputNames[0]) || "input";
  const out = await model({ [name]: pixel_values });
  let tensor = Object.values(out)[0][0];
  if (m.sigmoid) tensor = tensor.sigmoid();
  const mask = await t.RawImage.fromTensor(tensor.mul(255).to("uint8")).resize(c.width, c.height);
  const md = mask.data, ch = mask.channels || 1;
  // Stretch the mask so faint haze becomes clear and the subject becomes solid.
  const [lo, hi] = m.clean || [0, 255], gain = 255 / (hi - lo);
  for (let i = 0, n = c.width * c.height; i < n; i++) {
    const a = (md[i * ch] - lo) * gain;
    px.data[4 * i + 3] = Math.round(px.data[4 * i + 3] * Math.max(0, Math.min(255, a)) / 255);
  }
  ctx.putImageData(px, 0, 0);
  const blob = await new Promise((r) => c.toBlob(r, "image/png"));
  if (!blob) throw new Error("Export failed. Your browser may need more memory; try a smaller image.");
  return blob;
}

function show(href, outName) {
  viewImg.src = href;
  viewDl.href = href; viewDl.download = outName;
  view.hidden = false;
  view.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function handle(files) {
  if (busy) return;
  busy = true;
  msg.hidden = true;
  for (const file of files) {
    if (!/^image\//.test(file.type)) { msg.textContent = `${file.name} isn't a JPG, PNG or WebP image.`; msg.hidden = false; continue; }
    const li = document.createElement("li");
    const name = document.createElement("span"); name.className = "fname"; name.textContent = file.name;
    const meta = document.createElement("span"); meta.className = "fmeta";
    const actions = document.createElement("span"); actions.className = "factions";
    li.append(name, meta, actions); list.prepend(li);
    try {
      const blob = await cutout(file, (s) => { meta.textContent = s; });
      const outName = file.name.replace(/\.[^.]+$/, "") + "-no-bg.png";
      const href = URL.createObjectURL(blob);
      meta.textContent = "Done";
      const v = document.createElement("button");
      v.type = "button"; v.className = "btn btn-quiet"; v.textContent = "View";
      v.addEventListener("click", () => show(href, outName));
      const a = document.createElement("a");
      a.className = "btn btn-quiet"; a.textContent = "Download"; a.href = href; a.download = outName;
      actions.append(v, a);
      show(href, outName);
    } catch (e) {
      console.error(e);
      li.classList.add("bad");
      meta.textContent = e.message || "This didn't work. Check your connection, or try a smaller image.";
    }
  }
  busy = false;
}

$("choose").addEventListener("click", () => input.click());
input.addEventListener("change", () => { handle([...input.files]); input.value = ""; });
["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("dragging"); }));
["dragleave", "drop"].forEach((t) => drop.addEventListener(t, () => drop.classList.remove("dragging")));
drop.addEventListener("drop", (e) => { e.preventDefault(); handle([...e.dataTransfer.files]); });
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => e.preventDefault());
document.querySelectorAll("[data-bg]").forEach((b) => b.addEventListener("click", () => { view.dataset.bg = b.dataset.bg; }));
