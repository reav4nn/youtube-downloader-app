const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

function runYtDlp(url, options = {}, onProgress = () => {}, onComplete = () => {}, onError = () => {}) {
  const args = [];
  // assemble basic args
  if (options.audioOnly) {
    args.push('-x', '--audio-format', 'mp3');
  }
  if (options.format) {
    args.push('-f', options.format);
  } else {
    args.push('-f', 'best');
  }

  // output template
  const outDir = path.resolve(process.env.DOWNLOAD_PATH || path.join(__dirname, '..', 'downloads'));
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outTemplate = path.join(outDir, '%(title)s-%(id)s.%(ext)s');
  args.push('-o', outTemplate);

  // progress
  args.push('--newline');

  // yt-dlp path resolve
  const localYt = path.join(
    __dirname,
    'bin',
    process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
  );

  const ytDlpPath =
    (fs.existsSync(localYt) ? localYt : (process.env.YT_DLP_PATH || 'yt-dlp'));

  // ffmpeg resolve
  const localFfmpeg = path.join(
    __dirname,
    'bin',
    process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
  );

  const ffmpegPath =
    (fs.existsSync(localFfmpeg) ? localFfmpeg : (process.env.FFMPEG_LOCATION || 'ffmpeg'));

  if (ffmpegPath) {
    args.push('--ffmpeg-location', ffmpegPath);
  }
  // YouTube cookies support
  try {
    const cookiesPath = path.join(__dirname, 'cookies.txt');
    if (fs.existsSync(cookiesPath)) {
      args.push('--cookies', cookiesPath);
      try { console.log('[runner] cookies =', cookiesPath); } catch (e) {}
    }
  } catch (e) {
    try { console.warn('[runner] cookies detection error:', e.message); } catch (_) {}
  }
  // Log spawn details
  try {
    console.log('[runner] cwd=', process.cwd());
    console.log('[runner] outDir=', outDir);
    console.log('[runner] yt-dlp =', ytDlpPath);
    console.log('[runner] ffmpeg =', ffmpegPath);
    console.log('[runner] args=', JSON.stringify(args));
  } catch (e) {}

  args.push(url);

  // spawn
  let proc;
  try {
    proc = spawn(ytDlpPath, args, { cwd: process.cwd(), env: process.env });
  } catch (e) {
    console.error('[runner] spawn error:', e.message);
    onError(e);
    return;
  }

    let lastFilename = null;
  proc.stdout.on('data', (data) => {
    const text = data.toString();
    try { console.log('[runner][stdout]', text.trim()); } catch (e) {}
    // detect final output filenames
    const merge = text.match(/Merging formats into\s+\"(.+?)\"/);
    if (merge && merge[1]) {
      const pth = merge[1].trim();
      lastFilename = path.isAbsolute(pth) ? pth : path.join(outDir, pth);
      onProgress({ raw: text, filename: lastFilename });
      return;
    }
    const dest = text.match(/Destination:\s*(.*)/);
    if (dest && dest[1]) {
      const pth = dest[1].trim();
      lastFilename = path.isAbsolute(pth) ? pth : path.join(outDir, pth);
      onProgress({ raw: text, filename: lastFilename });
      return;
    }
    // try to extract percentage like "[download]   12.3%"
    const m = text.match(/(\d{1,3}\.\d|\d{1,3})%/);
    if (m) {
      onProgress({ percent: parseFloat(m[0]) });
    } else {
      onProgress({ raw: text });
    }
  });
    } else {
      onProgress({ raw: text });
    }
  });

  proc.stderr.on('data', (data) => {
    const msg = data.toString();
    try { console.log('[runner][stderr]', msg.trim()); } catch (e) {}
    onProgress({ raw: msg });
  });

  proc.on('error', (err) => {
    console.error('[runner] process error:', err.message);
    onError(err);
  });

    proc.on('close', (code) => {
    console.log('[runner] process closed with code', code);
    if (code === 0) {
      let finalPath = lastFilename;
      try {
        if (!finalPath) {
          const files = fs.readdirSync(outDir).filter(f => /\.(mp4|webm|mkv|mp3|m4a|opus)$/i.test(f));
          if (files.length) {
            const withTime = files.map(f => ({ f, t: fs.statSync(path.join(outDir, f)).mtimeMs }));
            withTime.sort((a,b) => b.t - a.t);
            finalPath = path.join(outDir, withTime[0].f);
            console.log('[runner] fallback finalPath =', finalPath);
          }
        }
      } catch (e) {
        console.warn('[runner] finalPath detection error:', e.message);
      }
      onComplete(finalPath);
    } else {
      onError(new Error('yt-dlp exited with code ' + code));
    }
  });

  return proc;
}

module.exports = { runYtDlp };
