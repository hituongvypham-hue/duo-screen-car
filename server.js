const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3333;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

function handleRequest(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API 1: /api/yt-search
  if (pathname === '/api/yt-search') {
    const q = parsedUrl.query.q || '';
    if (!q) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ videos: [] }));
      return;
    }

    const targetUrl = `https://duoscreen.vercel.app/api/yt-search?q=${encodeURIComponent(q)}`;
    https.get(targetUrl, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      proxyRes.pipe(res);
    }).on('error', (err) => {
      console.error('Error fetching yt-search:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message, videos: [] }));
    });
    return;
  }

  // API 2: /api/tts
  if (pathname === '/api/tts') {
    const q = parsedUrl.query.q || '';
    if (!q) {
      res.writeHead(400);
      res.end('Missing query parameter q');
      return;
    }

    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q=${encodeURIComponent(q)}`;
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://translate.google.com/',
      }
    };

    https.get(ttsUrl, options, (proxyRes) => {
      if (proxyRes.statusCode === 200) {
        res.writeHead(200, {
          'Content-Type': 'audio/mpeg',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=86400',
        });
        proxyRes.pipe(res);
      } else {
        https.get(`https://duoscreen.vercel.app/api/tts?q=${encodeURIComponent(q)}`, (upRes) => {
          res.writeHead(upRes.statusCode || 200, {
            'Content-Type': 'audio/mpeg',
            'Access-Control-Allow-Origin': '*',
          });
          upRes.pipe(res);
        }).on('error', (e) => {
          res.writeHead(500);
          res.end('TTS error: ' + e.message);
        });
      }
    }).on('error', (err) => {
      console.error('Error proxying TTS:', err);
      res.writeHead(500);
      res.end('TTS error: ' + err.message);
    });
    return;
  }

  // API 3: /api/sync-users (Cloud Sync for User Profiles & Playlists)
  if (pathname === '/api/sync-users') {
    const CLOUD_URL = 'https://api.restful-api.dev/objects/ff808181a09d98f701a167ef41fd68aa';

    if (req.method === 'GET') {
      https.get(CLOUD_URL, (cloudRes) => {
        let body = '';
        cloudRes.on('data', chunk => body += chunk);
        cloudRes.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            res.writeHead(200, {
              'Content-Type': 'application/json; charset=utf-8',
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'no-cache, no-store, must-revalidate'
            });
            res.end(JSON.stringify(parsed.data || { users: [] }));
          } catch(e) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ users: [] }));
          }
        });
      }).on('error', (err) => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      });
      return;
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      let reqBody = '';
      req.on('data', chunk => reqBody += chunk);
      req.on('end', () => {
        try {
          const payload = JSON.parse(reqBody);
          const putPayload = JSON.stringify({
            name: 'duoscreen_carplay_users',
            data: payload
          });

          const putReq = https.request(CLOUD_URL, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(putPayload)
            }
          }, (putRes) => {
            let putResBody = '';
            putRes.on('data', chunk => putResBody += chunk);
            putRes.on('end', () => {
              res.writeHead(200, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              });
              res.end(JSON.stringify({ success: true }));
            });
          });

          putReq.on('error', (err) => {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          });

          putReq.write(putPayload);
          putReq.end();
        } catch(e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }
  }

  // Static files: check root, then public, then fallback to index.html
  let relPath = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  let filePath = path.join(__dirname, relPath);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    const publicPath = path.join(__dirname, 'public', relPath);
    if (fs.existsSync(publicPath) && !fs.statSync(publicPath).isDirectory()) {
      filePath = publicPath;
    } else {
      filePath = path.join(__dirname, 'index.html');
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (readErr, content) => {
    if (readErr) {
      res.writeHead(404);
      res.end('File Not Found');
      return;
    }
    const headers = {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    };
    if (ext === '.html' || ext === '.js') {
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
      headers['Pragma'] = 'no-cache';
      headers['Expires'] = '0';
    }
    res.writeHead(200, headers);
    res.end(content);
  });
}

const server = http.createServer(handleRequest);

if (!process.env.VERCEL) {
  server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚗 DUOSCREEN CARPLAY DASHBOARD ĐANG CHẠY TẠI:`);
    console.log(`👉 http://localhost:${PORT}`);
    console.log(`======================================================\n`);
  });
}

module.exports = handleRequest;
