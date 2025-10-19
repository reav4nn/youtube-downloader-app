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

  proc.stdout.on('data', (data) => {
    const text = data.toString();
    try { console.log('[runner][stdout]', text.trim()); } catch (e) {}
    // try to extract percentage like "[download]   12.3%"
    const m = text.match(/(\d{1,3}\.\d|\d{1,3})%/);
    if (m) {
      onProgress({ percent: parseFloat(m[0]) });
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
    if (code === 0) onComplete();
    else onError(new Error('yt-dlp exited with code ' + code));
  });

  return proc;
}

module.exports = { runYtDlp };
