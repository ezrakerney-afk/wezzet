# WezzetAI model server for a free Hugging Face Space (CPU basic: 2 vCPU, 16 GB, no card needed).
# Serves an open-weight GGUF model with llama.cpp's OpenAI-compatible server on port 7860.
# To use our own fine-tuned weights, upload the GGUF to a Hugging Face model repo and change MODEL_REPO / MODEL_FILE.
FROM ghcr.io/ggml-org/llama.cpp:server
ENV MODEL_REPO=Qwen/Qwen3-4B-GGUF \
    MODEL_FILE=Qwen3-4B-Q4_K_M.gguf
EXPOSE 7860
ENTRYPOINT ["/bin/sh", "-c", "/app/llama-server --hf-repo $MODEL_REPO --hf-file $MODEL_FILE --host 0.0.0.0 --port 7860 --ctx-size 8192 --parallel 2 --threads 2 --jinja --api-key \"$API_KEY\""]
