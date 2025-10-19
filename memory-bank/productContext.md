# productContext

why: Provide a fast, minimal, self-hosted web interface for downloading YouTube videos for offline use (educational/offline viewing/workflow ingestion).

problems_it_solves:
- Simplifies yt-dlp usage with a friendly UI.
- Removes CLI friction for users uncomfortable with command-line tools.
- Allows selecting format and quality without remembering format codes.

user_personas:
- Casual user: wants to save single videos quickly.
- Power user: wants format/quality control and occasional bulk operations.
- Self-hosting admin: wants private hosting and control over data.

primary_use_cases:
- Paste a YouTube link, choose format and quality, press "Download", get progress and a link to the file.
- Extract audio-only files (MP3) from videos.

ux_goals:
- Minimal steps to download (3 or fewer).
- Responsive design that works on desktop and mobile.
- Clear progress feedback and error messages.

notes:
- UI-first approach. Authentication (Google SSO) deferred to later phases.
- PWA targeted in later phases for offline-friendly behavior.