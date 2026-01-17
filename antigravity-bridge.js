const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const LOG_DIR = path.join(__dirname, 'logs');
const LIVE_CONTEXT_FILE = path.join(LOG_DIR, 'live_context.json');

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR);
}

const server = http.createServer((req, res) => {
    // CORS headers for Vercel deployment access
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url === '/sync') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                fs.writeFileSync(LIVE_CONTEXT_FILE, JSON.stringify(data, null, 2));
                console.log(`[${new Date().toLocaleTimeString()}] Context Sync successful: ${data.current_phase}`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'success' }));
            } catch (err) {
                console.error('Sync Error:', err);
                res.writeHead(400);
                res.end('Invalid JSON');
            }
        });
    } else {
        res.writeHead(404);
        res.end();
    }
});

server.listen(PORT, () => {
    console.log(`🚀 Antigravity Bridge running at http://localhost:${PORT}`);
    console.log(`📁 Syncing to: ${LIVE_CONTEXT_FILE}`);
});
