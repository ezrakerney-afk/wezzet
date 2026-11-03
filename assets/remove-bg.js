/* Wezzet background remover. Runs an open-source cutout model in the browser
   with Transformers.js; the model downloads once, photos never leave the device. */
const LIB = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.3";
const MODELS = {
  person: { id: "Xenova/modnet", input: "input", sigmoid: false, mb: 26 },
  any: { id: "onnx-community/BiRefNet_lite-ONNX", input: "input_image", sigmoid: true, mb: 115, dtype: "fp16", gpuOnly: true },
};

const $ = (id) => document.getElementById(id);
const drop = $("drop"), input = $("files"), list = $("list"), msg = $("msg");
const DT = (m, device) => (device === "webgpu" && m.dtype) || "fp32";
const kind = () => document.querySelector('input[name="kind"]:checked').value;
let lib = null;
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
      let gpu = null;
      try { gpu = navigator.gpu && (await navigator.gpu.requestAdapter()); } catch (e) {}
      const device = gpu ? "webgpu" : "wasm";
      if (m.gpuOnly && !gpu) throw new Error("gpu");
      const progress = (p) => { if (p.status === "progress" && p.file && /onnx/.test(p.file)) status(`Downloading the model, ${Math.round(p.progress || 0)}%`); };
      let model;
      try {
        model = await t.AutoModel.from_pretrained(m.id, { device, dtype: DT(m, device), progress_callback: progress });
      } catch (e) {
        if (device === "wasm") throw e;
        model = await t.AutoModel.from_pretrained(m.id, { device: "wasm", dtype: DT(m, "wasm"), progress_callback: progress });
      }
      const processor = await t.AutoProcessor.from_pretrained(m.id);
      return { t, m, model, processor };
    })();
    loaded[k].catch(() => { delete loaded[k]; });
  }
  return loaded[k];
}

async function cutout(file, status) {
  const k = kind();
  status(`Loading the model (about ${MODELS[k].mb} MB, only the first time)`);
  const { t, m, model, processor } = await loadModel(k, status);
  status("Removing the background");
  const url = URL.createObjectURL(file);
  try {
    const image = await t.RawImage.fromURL(url);
    const { pixel_values } = await processor(image);
    const out = await model({ [m.input]: pixel_values });
    let tensor = Object.values(out)[0][0];
    if (m.sigmoid) tensor = tensor.sigmoid();
    const mask = await t.RawImage.fromTensor(tensor.mul(255).to("uint8")).resize(image.width, image.height);
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const c = document.createElement("canvas");
    c.width = image.width; c.height = image.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const px = ctx.getImageData(0, 0, c.width, c.height);
    for (let i = 0; i < mask.data.length; i++) px.data[4 * i + 3] = mask.data[i];
    ctx.putImageData(px, 0, 0);
    return await new Promise((r) => c.toBlob(r, "image/png"));
  } finally { URL.revokeObjectURL(url); }
}

async function handle(files) {
  msg.hidden = true;
  for (const file of files) {
    if (!/^image\//.test(file.type)) { msg.textContent = `${file.name} isn't a JPG, PNG or WebP image.`; msg.hidden = false; continue; }
    const li = document.createElement("li");
    li.className = "cut";
    const name = document.createElement("span"); name.className = "fname"; name.textContent = file.name;
    const meta = document.createElement("span"); meta.className = "fmeta";
    const actions = document.createElement("span"); actions.className = "factions";
    li.append(name, meta, actions); list.append(li);
    try {
      const blob = await cutout(file, (s) => { meta.textContent = s; });
      const outName = file.name.replace(/\.[^.]+$/, "") + "-no-bg.png";
      const href = URL.createObjectURL(blob);
      meta.textContent = "Done";
      const a = document.createElement("a");
      a.className = "btn btn-quiet"; a.textContent = "Download PNG"; a.href = href; a.download = outName;
      actions.append(a);
      const pic = document.createElement("img");
      pic.className = "checker"; pic.src = href; pic.alt = "Cutout of " + file.name;
      li.append(pic);
    } catch (e) {
      console.error(e);
      li.classList.add("bad");
      meta.textContent = e && e.message === "gpu" ? "Anything else needs a browser with WebGPU, like recent Chrome, Edge or Safari. Try A person instead."
        : "This didn't work. Check your connection, or try a smaller image.";
    }
  }
}

// The bigger model only runs well on the graphics card, so turn that option off when there isn't one.
(async () => {
  let ok = false;
  try { ok = !!(navigator.gpu && (await navigator.gpu.requestAdapter())); } catch (e) {}
  if (!ok) {
    const r = document.querySelector('input[name="kind"][value="any"]');
    r.disabled = true; r.closest("label").title = "Needs a browser with WebGPU, like recent Chrome, Edge or Safari";
    $("gpu-note").hidden = false;
  }
})();

$("choose").addEventListener("click", () => input.click());
input.addEventListener("change", () => { handle([...input.files]); input.value = ""; });
["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("dragging"); }));
["dragleave", "drop"].forEach((t) => drop.addEventListener(t, () => drop.classList.remove("dragging")));
drop.addEventListener("drop", (e) => { e.preventDefault(); handle([...e.dataTransfer.files]); });
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => e.preventDefault());
