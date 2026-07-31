// Combined single-process launcher: runs the NestJS backend and the
// Next.js frontend as two child processes on internal-only ports, then
// reverse-proxies both under one public port — the backend at /api/*
// (it already uses an /api/v1 prefix internally), everything else to the
// frontend. Exists because the hosting plan has a limited number of app
// "slots", so both halves of the product have to share one deployment.
const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const path = require('path');
const httpProxy = require('http-proxy');

const PUBLIC_PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const BACKEND_PORT = 8201;
const FRONTEND_PORT = 8202;

function log(msg) {
  console.log(`[combined-server ${new Date().toISOString()}] ${msg}`);
}

function waitForPort(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    (function attempt() {
      const socket = net.connect(port, '127.0.0.1');
      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() > deadline) {
          reject(new Error(`Timed out waiting for port ${port}`));
        } else {
          setTimeout(attempt, 300);
        }
      });
    })();
  });
}

// Backend: run the compiled NestJS entry directly with node (not `npm
// start`, for the same reason established earlier — some hosts run this
// file directly and npm lifecycle hooks can't be relied on anyway).
const backend = spawn(
  process.execPath,
  [path.join(__dirname, 'backend', 'dist', 'main.js')],
  {
    cwd: path.join(__dirname, 'backend'),
    env: { ...process.env, PORT: String(BACKEND_PORT) },
    stdio: 'inherit',
  },
);
backend.on('exit', (code) => {
  log(`Backend process exited with code ${code} — exiting so the host restarts the whole app.`);
  process.exit(1);
});

// Frontend: invoke Next.js's CLI entry file directly with node (avoids the
// .bin/next(.cmd) wrapper needing a shell on Windows, and matches the
// pattern used for the Prisma CLI elsewhere in this project). Its own
// NEXT_PUBLIC_API_URL/rewrite mechanism (next.config.ts) is pointed at the
// internal backend port as a consistent fallback, even though this
// server's own /api/* routing below handles it first in practice.
const frontend = spawn(
  process.execPath,
  [
    path.join(__dirname, 'frontend', 'node_modules', 'next', 'dist', 'bin', 'next'),
    'start',
    '-p',
    String(FRONTEND_PORT),
  ],
  {
    cwd: path.join(__dirname, 'frontend'),
    env: { ...process.env, PORT: String(FRONTEND_PORT) },
    stdio: 'inherit',
  },
);
frontend.on('exit', (code) => {
  log(`Frontend process exited with code ${code} — exiting so the host restarts the whole app.`);
  process.exit(1);
});

const proxy = httpProxy.createProxyServer({});
proxy.on('error', (err, req, res) => {
  log(`Proxy error for ${req.url}: ${err.message}`);
  if (!res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
  }
  res.end(JSON.stringify({ detail: 'Upstream service unavailable' }));
});

const server = http.createServer((req, res) => {
  const target = req.url.startsWith('/api/') || req.url === '/api'
    ? `http://127.0.0.1:${BACKEND_PORT}`
    : `http://127.0.0.1:${FRONTEND_PORT}`;
  proxy.web(req, res, { target });
});

server.on('upgrade', (req, socket, head) => {
  const target = req.url.startsWith('/api/')
    ? `http://127.0.0.1:${BACKEND_PORT}`
    : `http://127.0.0.1:${FRONTEND_PORT}`;
  proxy.ws(req, socket, head, { target });
});

async function main() {
  log('Waiting for backend and frontend child processes to start listening...');
  await Promise.all([
    waitForPort(BACKEND_PORT, 30000),
    waitForPort(FRONTEND_PORT, 30000),
  ]);
  log('Both children are up — starting public reverse proxy.');
  server.listen(PUBLIC_PORT, '0.0.0.0', () => {
    log(`Combined server listening on port ${PUBLIC_PORT} (backend -> :${BACKEND_PORT}, frontend -> :${FRONTEND_PORT})`);
  });
}

main().catch((err) => {
  log(`Fatal error during startup: ${err.stack || err}`);
  process.exit(1);
});

process.on('SIGTERM', () => {
  log('Received SIGTERM, shutting down children.');
  backend.kill();
  frontend.kill();
  process.exit(0);
});
