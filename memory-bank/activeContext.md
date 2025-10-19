# activeContext

current_focus: Phase 2 integration work
- Real-time progress via SSE is implemented; frontend uses EventSource.
- Link DB entries to actual downloaded files (filename/filepath) and expose listing.
- Frontend shows visible progress state and auto-downloads file on completion.
- Frontend wired to `/api/downloads` list for recent downloads.
 - Recent Downloads auto-refreshes on app load (initial GET /api/downloads on mount).
- Delete flow added: DELETE `/api/downloads/:id` removes DB record and file; UI has a delete button on completed items.
- SSE reliability: added heartbeat (~20s), pruned dead clients, cleanup on disconnect/reconnect, switched SSE client store to a plain object, and fixed init order to prevent `.add` on undefined.
- yt-dlp runner updated to always fetch `bestvideo+bestaudio` and merge into MP4; detects final merged filename for DB/SSE.
- Added audio-only MP3 mode: `-x --audio-format mp3 --audio-quality 0` with ffmpeg conversion; DB/SSE now carry final .mp3 filename.
- Unified Format control: removed Mode toggle. Single Format dropdown lists video (mp4/webm/mkv) and audio (mp3/m4a/opus). Backend derives audio-only vs video from selected format. Quality dropdown adapts to chosen format type.
- Audio-only reliability: user-selectable mp3/m4a/opus; mp3 converts via ffmpeg; m4a/opus extract; fallback to m4a only on real conversion failure (reported via SSE `last` message); verify output exists before marking completed.
 - ffmpeg detection: backend auto-detects ffmpeg/ffprobe and passes `--ffmpeg-location`; if missing, surfaces a clear SSE error and does not silently fallback.
- Downloads directory is now project-local at `<repo_root>/downloads`; created on startup; `/files` serves from this folder.
- Recent Downloads is session-scoped: starts empty on each visit; history loads only when user clicks "Load history".
- Options selectors (Format, Quality) styled with site dark red palette and base font; navbar updated to Home/About/Contact; profile removed; help icon aligned with aria-label.
 - Removed quick preset buttons (Best MP4, Best MP3); kept improved error display in UI.
 - Implemented a simple background worker queue with configurable concurrency (env `CONCURRENCY`, default 1).
- Dropdowns refined: select/option/optgroup inherit site font; optgroup labels not italic; dark red hover/focus/border colors applied globally.
- Removed duplicate navbar on Home; only the main top navigation remains.
 - AdSense: added Google AdSense script in `frontend/public/index.html` head (client `ca-pub-1483280867963435`).
- Optimizations: fixed UI text encoding for status messages, cleaned SSE URL usage, added explicit button types, and ensured yt-dlp uses safe filenames via `--restrict-filenames`.
 - Frontend default API base now points to Render deployment; override with `VITE_API_BASE` for local/dev.
 - Frontend `.env` created with `VITE_API_BASE=https://youtube-downloader-app-vh39.onrender.com`; built to `frontend/dist` for Vercel.
- Added `vercel.json` at repo root to configure Vercel (Vite static build, output `dist`, `VITE_API_BASE` env). Committed and pushed to origin.
 - Backend: added `/healthz` and `/` JSON routes; ensured API routes come before static; added `render.yaml` to define Render build/start (build: cd backend && npm install; start: node backend/server.js). Committed and pushed.

recent_changes:
- Added SSE endpoint `/api/stream/:id` and wired to backend progress; frontend switched to EventSource.
- Capturing final output filename from yt-dlp and storing in DB (`filename`, `filepath`).
- New route `GET /api/downloads` returns DB entries with `file_url` when available.
- Added forced download endpoint `/files/download/:filename`; frontend now auto-triggers browser download when status becomes `completed`.
 - Updated yt-dlp format selection and added `--merge-output-format` (requires ffmpeg) to avoid corrupted/incomplete files.

next_steps:
1. Add SSE hardening (heartbeat keepalive, ensure cleanup on disconnect).
2. Optional: add delete endpoint for files/records and UI actions.
3. Consider WebSocket alternative only if future requirements need bidirectional messaging.

design_assets:
- User-supplied HTML/CSS design included below for reference.

---BEGIN DESIGN SNIPPET---

<!DOCTYPE html>
<html class="dark" lang="en"><head>
<meta charset="utf-8"/>
... (design truncated; full design saved in memory-bank/design.html)

---END DESIGN SNIPPET---

notes:
- Authentication (Google SSO) deferred until after UI is stable.
- Photo upload and AI analysis / manual food entry mentioned by user in conversation: this appears to be from a different project; ignore for this project.
 - ffmpeg and ffprobe installed and on PATH (confirmed by user) for yt-dlp merging/conversion.

workflow_preferences:
  run_behavior:
    default: "start frontend"
    if_backend_changed: "restart backend and frontend"
    always: "both servers must be running for testing"

 - Fixed stray \\\n\ token before DELETE route in backend/server.js that caused a SyntaxError on Render; committed and pushed.
 - Added extensive logging: spawn args/paths/cwd, stdout/stderr piping, completion/error codes; server logs progress, filename detection, SSE, and downloads dir writability.
 - Added YouTube cookies support: if backend/cookies.txt exists, runner passes --cookies with absolute path; cookies file ignored in git.
- Added /api/upload-cookies endpoint (raw text, token-protected via COOKIE_UPLOAD_TOKEN, writes backend/cookies.txt with mode 600).
- yt-dlp runner: cleaned syntax and handlers; prefers local binaries in `backend/bin`; logs spawn cwd/paths/args; auto-detects cookies; robust final filename detection (Destination/Merging or newest file fallback).
- Backend now records `filename` and `filepath` on completion and exposes them via `/api/downloads` with `file_url` served from `/files`.
