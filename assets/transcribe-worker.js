// Speech recognition stays in a worker so the page remains responsive.
let transcriber;
self.onmessage = async ({ data }) => {
  try {
    if (!transcriber) {
      const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.3');
      env.allowLocalModels = false;
      env.backends.onnx.wasm.numThreads = 1;
      transcriber = await pipeline('automatic-speech-recognition','Xenova/whisper-tiny.en', {
        device:'wasm', dtype:'q8', progress_callback:p=>{
          if(p.status==='progress') self.postMessage({status:`Downloading speech model: ${Math.round(p.progress||0)}%`});
        }
      });
    }
    const result = await transcriber(data.audio,{return_timestamps:true,chunk_length_s:30,stride_length_s:5});
    self.postMessage({ result });
  } catch(e) { self.postMessage({ error: e.message || 'Speech recognition failed.' }); }
};
