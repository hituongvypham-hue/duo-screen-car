const fs = require('fs');
const path = require('path');

const pub = path.join(__dirname, 'public');
fs.mkdirSync(pub, { recursive: true });

fs.copyFileSync(path.join(__dirname, 'index.html'), path.join(pub, 'index.html'));
fs.cpSync(path.join(__dirname, 'assets'), path.join(pub, 'assets'), { recursive: true });

if (fs.existsSync(path.join(__dirname, 'playlists.json'))) {
  fs.copyFileSync(path.join(__dirname, 'playlists.json'), path.join(pub, 'playlists.json'));
}

console.log('Build completed! Files ready in public/');
