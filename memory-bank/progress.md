# progress

project_phases:

Phase 0 – Project setup:
- [x] Create memory bank skeleton
- [x] Choose Node.js version and package manager (Node 20.x, npm)
- [x] Create repository scaffolding (frontend + backend)

Phase 1 – UI & basic flow (MVP):
- Tasks:
  - Scaffold React frontend with Tailwind (per provided design)
  - Create layout: paste-URL input, format + quality selectors, audio-only toggle
  - Implement download button to POST to backend
  - Implement simple Express endpoint to accept download requests (no auth)
  - Show download progress (initially basic; later real-time)
- Acceptance criteria:
  - User can paste a URL and start a download
  - Backend saves metadata to SQLite and stores downloaded file on disk
  - Frontend shows progress and final download link
- Status: [x] Completed

Phase 2 – Backend integration & features (current):
- Tasks:
  - [x] Integrate yt-dlp into backend (spawn child process, stream logs)
  - [x] Implement real-time progress updates via SSE (`/api/stream/:id`)
  - [x] Add sqlite schema and migration script (downloads table)
  - [x] Link DB rows to downloaded filenames and save `filename` + `filepath`
  - [x] Add `GET /api/downloads` that returns DB entries with `file_url`
  - [x] Frontend shows visible progress state and auto-downloads file on completion
  - [x] Ensure yt-dlp produces fully playable MP4 files (force `-f "bestvideo+bestaudio" --merge-output-format mp4`)
  - [x] Add audio-only MP3 mode using `-x --audio-format mp3 --audio-quality 0`; store final .mp3 name in DB and SSE
  - [x] Replace Mode toggle with unified Format dropdown (video: mp4/webm/mkv; audio: mp3/m4a/opus). Backend derives mode from format; Quality adapts by type.
  - [x] Audio-only robustness: default to source-matching container (m4a/opus) when unspecified; MP3 via ffmpeg; styled selects to match Tailwind dark theme
  - [x] Audio-only fallback: if selected conversion fails (e.g., mp3/opus), fallback to m4a automatically; verify output exists before status=completed
  - [x] Wire frontend UI to show recent downloads from `/api/downloads` (replaces directory scan)
  - [x] Add delete endpoint (DELETE `/api/downloads/:id`) and remove file
  - [x] Add UI delete action and refresh list after deletion
  - [x] Improve SSE reliability: heartbeat keepalive, prune closed clients, clean reconnections
  - [x] Fix SSE client store bug: switched from Map to plain object with safe initialization and corrected connection flow to avoid undefined `.add` errors
  - [x] Allow format/quality presets and more robust error handling
 - [x] Add background worker queue for concurrency

Recent updates:
- Implemented SSE end-to-end; frontend uses EventSource for live progress.
- Stored final output filename/path into DB; exposed `/api/downloads` with `file_url`.
- yt-dlp runner now merges streams into mp4/webm with ffmpeg, and detects the final merged filename to avoid triggering downloads too early.
- Manual test: download completed and appeared in `/api/downloads` with a working `/files/<filename>` link.
- ffmpeg/ffprobe installed and on global PATH (user confirmed) to support merging and audio conversions.
 - Frontend now auto-fetches `/api/downloads` on mount so Recent Downloads is populated without manual refresh.
- Backend now auto-detects ffmpeg and injects `--ffmpeg-location` into yt-dlp; emits clear SSE error if ffmpeg is not resolvable.
 - Downloads now project-local at `<repo_root>/downloads`; server ensures directory exists and serves `/files` from it.
 - Recent Downloads made session-scoped (empty on load); "Load history" fetches `/api/downloads` only on demand.
 - Options selects styled to site palette; navbar updated to Home/About/Contact; profile removed; help icon adjusted.
 - Removed duplicate navbar in Home; ensured single top navigation only.
 - Dropdown styling fix: unified font for select/option/optgroup, non-italic optgroup labels, dark-red themed hover/focus.
- Removed preset buttons (Best MP4/Best MP3) from Home per request.
- Optimizations: fixed UI text encoding for status text, simplified SSE URL, added button types to avoid unintended submits, added yt-dlp `--restrict-filenames` for Windows-safe names.
- AdSense: inserted script tag into `frontend/public/index.html` head with publisher id.
- Frontend points to Render API by default via `VITE_API_BASE`; production build generated in `frontend/dist` for Vercel deployment.
 - Render: added `render.yaml` with build/start commands and added health check routes on backend to avoid "Application Loading"; pushed to GitHub.
 - Added `vercel.json` for Vercel (static build using Vite, output `dist`) and pushed to origin.

Phase 3 – Advanced & deployment:
- Tasks:
  - [x] Implement Google SSO authentication
  - Add PWA features and offline caching
  - Implement exports, playlists, subtitles, bulk downloads
  - Documentation for self-hosting (nginx/reverse-proxy, systemd, Windows service)

known_issues:
- None currently.

notes:
- Keep phases visible in `progress.md` and update as work is completed.

 - Fixed SyntaxError in server.js by removing stray \\\n\ token before DELETE route; Render deploy should now start cleanly.
 - Added detailed backend logging to diagnose Render spawn issues: logs download start, args, cwd, stdout/stderr, close code; verifies downloads dir writability.
- YouTube cookies support: runner now auto-loads cookies from backend/cookies.txt when present, logs path, and ignores file in git.
 - Runner syntax fixed; consolidated stdout/stderr/close handling; logs binaries/args; detects final filename reliably and updates DB/API.
- Added token-protected cookies upload route and runner auto-detects backend/cookies.txt (--cookies), enabling uploads without SSH on Render.

Google SSO updates:
- Implemented Google OAuth 2.0 via Passport.js and express-session.
- Added routes: `/api/auth/google`, `/api/auth/google/callback`, `/api/auth/logout`, `/api/auth/user`.
- Sessions: SameSite=None; Secure cookies in production with `trust proxy` set for Render.
- CORS configured with credentials for Vercel frontend and localhost dev.
- Frontend header displays login button, user name + avatar, and logout.

Deployment updates:
- Frontend domain migrated from `https://youtube-downloader.vercel.app` to `https://youtube-downloader-app-nk79.vercel.app`.
- Backend CORS allowed origins and OAuth success redirect updated accordingly.

job_log:
- UNFINISHED CANCELLED JOB (recorded per user request)
