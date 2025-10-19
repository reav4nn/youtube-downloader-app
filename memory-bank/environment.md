# environment

os: Windows (user workspace)
shell: PowerShell
workspace_path: c:\Users\reavann\OneDrive\Desktop\YoutubeDownloader
yt-dlp_installed: true
node_version: 20.x (npm)
python_version: TBD (if needed for helper scripts)

notes:
- We'll assume the dev environment will install Node.js and yt-dlp as needed. Provide install instructions in README later.
- Frontend uses Vite (default port 5173). Backend listens on port 3000.
- For merging separate video/audio streams into a single playable file, `ffmpeg` is required and should be available on PATH.
 - ffmpeg/ffprobe installed and on global PATH (user confirmed).
 - Auth env vars required on backend: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`.
 - In production on Render, set `NODE_ENV=production` so session cookie uses `Secure` + `SameSite=None`.
 - CORS with credentials; allowed origins: `https://youtube-downloader-app-nk79.vercel.app`, `http://localhost:5173`.
