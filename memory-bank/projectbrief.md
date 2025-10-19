# projectbrief

project_name: VideoDownloader

short_description: A self-hosted web application to download YouTube videos. Users paste a video URL, pick format and quality, and download the file to the server which stores it for retrieval.

owner: (primary contact) — user (TBD)

license: TBD

goals:
- MVP: Build a responsive React UI and Express backend that calls yt-dlp to download a single video by URL with format and quality selection.
- Phase 1: UI-first. Implement paste-URL, format/quality selectors, download action, and progress display.
- Phase 2: Backend worker, sqlite storage for download metadata, progress updates (websocket or SSE), and file serving.
- Phase 3: Auth (Google SSO), PWA packaging, export data, playlists/subtitles, bulk downloads, and production deployment docs.

constraints:
- Self-hosted deployment by user.
- Initial focus on Windows development (PowerShell).