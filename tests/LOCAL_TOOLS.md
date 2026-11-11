# Local tools checks

Run `node tests/local-tools.cjs` with Node 24 and `@napi-rs/canvas` available.
The test uses a minimal DOM harness and a real canvas implementation. It verifies image transforms and PNG output, subtitle timestamp validation, the twelve formulas, AI route handling with a stub model binding, and real PDF extraction plus DOCX ZIP generation. It writes a temporary `wezzet-test-result.docx` in the operating system temp directory.

Run `node tests/google-auth.mjs` for the existing account regression tests.

Manual checks still needed in supported desktop/mobile browsers: model download and speech recognition, background-removal model execution at large dimensions, FFmpeg WASM execution/cancellation, and actual live-model quiz quality. Native FFmpeg sample trim/noise commands passed, but that does not verify WASM/browser memory behavior. No assertion of unlimited file size or transcription accuracy is made.

## Multitrack video editor

Run `node tests/video-editor.mjs` with native `ffmpeg` and `ffprobe` installed.
Checks cover source bounds, split offsets at changed speeds, ripple deletion,
project validation, and actual rendered video/audio, delayed clips, fades and
muted/audio-only timelines. Browser QA also exercised MP4 import, independent
video/audio lanes, split, duplicate, undo, dragging, project download/reopen,
media reconnection, and FFmpeg WASM MP4 export. The downloaded browser export
was checked with ffprobe for H.264, AAC, 1280×720 dimensions and timeline duration.

Projects store edit decisions, not media bytes. Original files must be reimported
after a fresh session. Each source is limited to 250 MB; browser codec and memory
limits apply. This editor supports basic layered editing and fades, not desktop
NLE features such as keyframes, chroma key, title composition or color grading.
