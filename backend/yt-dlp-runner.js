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
    process.env.YT_DLP_PATH || (fs.existsSync(localYt) ? localYt : 'yt-dlp');

  // ffmpeg resolve
  const localFfmpeg = path.join(
    __dirname,
    'bin',
    process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
  );

  const ffmpegPath =
    process.env.FFMPEG_LOCATION || localFfmpeg;

  if (ffmpegPath) {
    args.push('--ffmpeg-location', ffmpegPath);
  }

  args.push(url);

  // spawn
  const proc = spawn(ytDlpPath, args);

  proc.stdout.on('data', (data) => {
    const text = data.toString();
    // try to extract percentage like "[download]   12.3%"
    const m = text.match(/(\d{1,3}\.\d|\d{1,3})%/);
    if (m) {
      onProgress({ percent: parseFloat(m[0]) });
    } else {
      onProgress({ raw: text });
    }
  });

  proc.stderr.on('data', (data) => {
    onProgress({ raw: data.toString() });
  });

  proc.on('error', (err) => {
    onError(err);
  });

  proc.on('close', (code) => {
    if (code === 0) onComplete();
    else onError(new Error('yt-dlp exited with code ' + code));
  });

  return proc;
}

module.exports = { runYtDlp };
