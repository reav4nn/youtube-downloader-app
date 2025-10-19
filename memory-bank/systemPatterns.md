# systemPatterns

architecture_overview:
- React SPA (frontend) communicates with Express REST API.
- Express exposes endpoints: /api/download (POST), /api/status/:id (GET), /api/stream/:id (SSE), /api/files (GET), /files/:filename (static), /api/downloads (GET)
- Downloader worker: Express will enqueue tasks and spawn yt-dlp processes. For MVP the backend may call yt-dlp synchronously for a single request; later move to a worker queue.
- Storage: downloaded files stored on server filesystem; metadata saved in SQLite.

component_relationships:
- Frontend -> Backend API -> Downloader (yt-dlp) -> Filesystem/DB.

design_patterns:
- Command queue for downloads with worker pool (future).
- Use repository pattern for DB access (simple wrappers around sqlite queries).
- Error handling: capture yt-dlp stderr and status codes and surface to user.
 - SSE broadcasting hub per download id; clients subscribe via EventSource.

scalability_notes:
- File storage limited by host disk; recommend configurable storage location.
- Concurrency: default to single worker; make concurrency configurable.

operational_notes:
- Keep yt-dlp as an external binary to avoid licensing/packaging issues.
- Provide an install helper script (for Windows PowerShell) in later phases.
