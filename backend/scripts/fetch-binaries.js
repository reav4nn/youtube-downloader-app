const https = require('https');
const fs = require('fs');
const path = require('path');

const binDir = path.resolve(__dirname, '..', 'bin');
if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true });

function download(url, dest, mode = 0o755) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // redirect
        res.destroy();
        return resolve(download(res.headers.location, dest, mode));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download ${url}: ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          try { fs.chmodSync(dest, mode); } catch (_) {}
          resolve(dest);
        });
      });
    }).on('error', (err) => {
      try { fs.unlinkSync(dest); } catch (_) {}
      reject(err);
    });
  });
}

(async () => {
  try {
    // yt-dlp linux x86_64
    const ytDlpPath = path.join(binDir, 'yt-dlp');
    if (!fs.existsSync(ytDlpPath)) {
      const ytUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';
      console.log('Fetching yt-dlp...');
      await download(ytUrl, ytDlpPath);
      console.log('yt-dlp saved to', ytDlpPath);
    }

    // ffmpeg and ffprobe via npm static packages
    try {
      const ffmpegStatic = require('ffmpeg-static');
      if (ffmpegStatic) {
        const target = path.join(binDir, 'ffmpeg');
        if (!fs.existsSync(target)) {
          fs.copyFileSync(ffmpegStatic, target);
          fs.chmodSync(target, 0o755);
          console.log('ffmpeg copied to', target);
        }
      }
    } catch (e) {
      console.warn('ffmpeg-static not available:', e.message);
    }

    try {
      const ffprobeStatic = require('ffprobe-static');
      if (ffprobeStatic && ffprobeStatic.path) {
        const target = path.join(binDir, 'ffprobe');
        if (!fs.existsSync(target)) {
          fs.copyFileSync(ffprobeStatic.path, target);
          fs.chmodSync(target, 0o755);
          console.log('ffprobe copied to', target);
        }
      }
    } catch (e) {
      console.warn('ffprobe-static not available:', e.message);
    }
  } catch (err) {
    console.error('fetch-binaries failed:', err);
    process.exitCode = 0; // do not fail build hard
  }
})();

