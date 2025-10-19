const http = require('http');
const data = JSON.stringify({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/download',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('STATUS', res.statusCode);
    console.log('BODY', body);
  });
});
req.on('error', (e) => console.error('ERR', e));
req.write(data);
req.end();
