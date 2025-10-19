# Backend — VideoDownloader

This Express backend provides a minimal API to start video downloads using `yt-dlp` and stores metadata in SQLite.

Quick start (PowerShell):

```powershell
cd backend
npm install
# ensure yt-dlp is installed and available in PATH or set YT_DLP_PATH in .env
npm run start
```

Endpoints:
- POST /api/download { url, format, quality, audioOnly } -> { id }
- GET /api/status/:id -> { percent, status }
- GET /api/stream/:id -> Server-Sent Events stream with progress updates
- GET /api/files -> [ filenames ]
- GET /files/:filename -> file
- GET /files/download/:filename -> force browser download (Content-Disposition: attachment)
- GET /api/downloads -> list of DB entries with file_url when available
- DELETE /api/downloads/:id -> delete DB entry and the file if it exists

Authentication (Google SSO):
- GET /api/auth/google -> start OAuth flow
- GET /api/auth/google/callback -> handle OAuth redirect
- GET /api/auth/user -> returns current user (id, displayName, email, photo) or 401
- GET /api/auth/logout -> clears session

Notes:
- Downloads are saved to `../downloads` by default; change via `DOWNLOAD_PATH` env var.
- The `downloads` table stores `filename` (basename) and `filepath` (absolute) on completion.
- For merged MP4/WEBM outputs, `ffmpeg` must be installed and available on PATH. yt-dlp uses ffmpeg for merging formats.
- Backend auto-detects ffmpeg. You can also set `FFMPEG_LOCATION` in `.env` to explicitly point yt-dlp to ffmpeg/ffprobe.
- Keep `.env` out of source control.

Env vars for auth:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SESSION_SECRET`

Authorized redirect URIs (set in Google Cloud Console):
- `https://<<REDACTED-BACKEND>>/api/auth/google/callback`
- `http://localhost:3000/api/auth/google/callback`
