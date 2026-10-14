import type { HealthResponse, DemoResponse } from '@mu-survivor/models';
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};
export function configuration(env: NodeJS.ProcessEnv = process.env) {
  const port = Number(env.PORT || 5173);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('PORT must be an integer between 1 and 65535');
  if (env.SERVE_UI !== undefined && !['true', 'false'].includes(env.SERVE_UI))
    throw new Error('SERVE_UI must be true or false');
  let upstream: URL | undefined;
  if (env.INTERNAL_API_URL) {
    upstream = new URL(env.INTERNAL_API_URL);
    if (
      !['http:', 'https:'].includes(upstream.protocol) ||
      upstream.username ||
      upstream.password ||
      upstream.pathname !== '/' ||
      upstream.search ||
      upstream.hash
    )
      throw new Error('INTERNAL_API_URL must be an http(s) origin, without credentials or a path');
  }
  if (env.SERVE_UI === 'false' && upstream)
    throw new Error('API-only service must not set INTERNAL_API_URL');
  return {
    port,
    host: env.HOST || (env.NODE_ENV === 'production' ? '::' : '127.0.0.1'),
    serveUI: env.SERVE_UI !== 'false',
    upstream,
  };
}
interface ServerOptions {
  production?: boolean;
  serveUI?: boolean;
  upstream?: URL;
  uiRoot?: string;
}
export function createServer({
  production = false,
  serveUI = true,
  upstream,
  uiRoot,
}: ServerOptions = {}) {
  const root = uiRoot || path.join(app, 'apps/ui/dist');
  if (serveUI && !fs.existsSync(path.join(root, 'index.html')))
    throw new Error('UI build missing. Run npm start or npm run build first.');
  return http.createServer((req, res) => {
    let requested, url;
    try {
      url = new URL(req.url || '/', 'http://localhost');
      requested = decodeURIComponent(url.pathname);
      if (requested.includes('\0')) throw new Error();
    } catch {
      res.writeHead(400).end();
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    function json(
      status: number,
      value: HealthResponse | DemoResponse | { ok: boolean; error?: string },
    ) {
      const body = JSON.stringify(value);
      res.writeHead(status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Content-Length': Buffer.byteLength(body),
      });
      res.end(req.method === 'HEAD' ? undefined : body);
    }
    if (requested === '/healthz') {
      json(200, { ok: true });
      return;
    }
    if (requested.startsWith('/api/') && upstream) {
      // Only the server sees the private origin; browsers always request same-origin /api.
      const target = new URL(upstream);
      target.pathname = url.pathname;
      target.search = url.search;
      const proxy = (target.protocol === 'https:' ? https : http).request(
        target,
        { method: req.method, headers: { accept: req.headers.accept || 'application/json' } },
        (response) => {
          const headers: http.OutgoingHttpHeaders = { 'Cache-Control': 'no-store' };
          for (const key of ['content-type', 'content-length'])
            if (response.headers[key]) headers[key] = response.headers[key];
          res.writeHead(response.statusCode || 502, headers);
          response.on('error', () => res.destroy());
          response.pipe(res);
        },
      );
      proxy.setTimeout(5000, () => proxy.destroy(new Error('Upstream timeout')));
      proxy.on('error', () => {
        if (!res.headersSent) json(502, { ok: false, error: 'Internal API unavailable' });
        else res.destroy();
      });
      res.on('close', () => proxy.destroy());
      proxy.end();
      return;
    }
    if (requested === '/api/health') {
      json(200, { ok: true, game: 'MU Survivor', mode: production ? 'production' : 'development' });
      return;
    }
    if (requested === '/api/demo') {
      json(200, {
        stage: 'Lorencia',
        durationSeconds: 180,
        characters: 3,
        enemyTypes: 5,
        skillsPerCharacter: 2,
        accounts: false,
      });
      return;
    }
    if (requested.startsWith('/api/') || !serveUI) {
      res.writeHead(404).end('Not found');
      return;
    }
    const file = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested));
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    fs.stat(file, (error, stat) => {
      if (error || !stat.isFile()) {
        res.writeHead(404).end('Not found');
        return;
      }
      let start = 0,
        end = stat.size - 1,
        status = 200;
      const headers: http.OutgoingHttpHeaders = {
        'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
        'Accept-Ranges': 'bytes',
        'X-Content-Type-Options': 'nosniff',
      };
      if (req.headers.range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
        if (match && (match[1] || match[2])) {
          if (!match[1]) start = Math.max(0, stat.size - Number(match[2]));
          else {
            start = Number(match[1]);
            if (match[2]) end = Math.min(end, Number(match[2]));
          }
        }
        if (
          !match ||
          (!match[1] && !match[2]) ||
          start > end ||
          start >= stat.size ||
          !Number.isSafeInteger(start) ||
          !Number.isSafeInteger(end)
        ) {
          res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }).end();
          return;
        }
        status = 206;
        headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
      }
      headers['Content-Length'] = stat.size ? end - start + 1 : 0;
      res.writeHead(status, headers);
      if (req.method === 'HEAD' || !stat.size) {
        res.end();
        return;
      }
      const stream = fs.createReadStream(file, { start, end });
      stream.on('error', () => res.destroy());
      res.on('close', () => stream.destroy());
      stream.pipe(res);
    });
  });
}
