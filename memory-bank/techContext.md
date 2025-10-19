# techContext

primary_stack:
- frontend: React (user provided)
- backend: Express (Node.js)
- database: SQLite (file-based, lightweight)
- downloader: yt-dlp (external dependency invoked by backend)

ai_services:
- vision/analysis model: gpt-5-mini (user provided). Configure API key and preferred model in `.env`.

dev_environment:
- development OS: Windows (user workspace)
- default shell: PowerShell
- self-hosting: yes (user will self-host)

dependencies / tools:
- Node.js (version: TBD) and npm or pnpm
- yt-dlp: user or server must install; backend will call it via child_process/spawn
- sqlite3 or better-sqlite3 Node client
- WebSocket or SSE for progress streaming (TBD)

security & privacy:
- No telemetry by default.
- Sensitive keys stored in `.env` and never checked in. Provide `.env.example`.

progress_streaming:
- Implemented using SSE. Endpoint: `/api/stream/:id`. Frontend uses `EventSource`.

notes:
- Simple React app and Express API with CORS for local use. Later, add HTTPS and reverse-proxy deployment instructions.
