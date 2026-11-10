# Local tools checks

Run `node tests/local-tools.cjs` with Node 24 and `@napi-rs/canvas` available.
The test uses a minimal DOM harness and a real canvas implementation. It verifies image transforms and PNG output, subtitle timestamp validation, the twelve formulas, AI route handling with a stub model binding, and real PDF extraction plus DOCX ZIP generation. It writes a temporary `wezzet-test-result.docx` in the operating system temp directory.

Run `node tests/google-auth.mjs` for the existing account regression tests.

Manual checks still needed in supported desktop/mobile browsers: model download and speech recognition, background-removal model execution at large dimensions, FFmpeg WASM execution/cancellation, and actual live-model quiz quality. Native FFmpeg sample trim/noise commands passed, but that does not verify WASM/browser memory behavior. No assertion of unlimited file size or transcription accuracy is made.
