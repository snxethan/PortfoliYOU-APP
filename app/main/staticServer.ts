import http from 'node:http';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let server: http.Server | null = null;
let servingDir: string | null = null;

function contentTypeFor(ext: string) {
    const map: Record<string, string> = {
        '.html': 'text/html; charset=utf-8',
        '.htm': 'text/html; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.mjs': 'application/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.webp': 'image/webp',
        '.ico': 'image/x-icon',
        '.txt': 'text/plain; charset=utf-8',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
        '.map': 'application/octet-stream'
    };
    return map[ext.toLowerCase()] || 'application/octet-stream';
}

function chooseLanAddress() {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
        const addrs = nets[name] || [];
        for (const a of addrs) {
            if (a.family === 'IPv4' && !a.internal) return a.address;
        }
    }
    return '127.0.0.1';
}

export async function startStaticServer(dir: string, host = '0.0.0.0') {
    if (!dir) throw new Error('No directory');
    const stat = await fs.stat(dir).catch(() => null);
    if (!stat || !stat.isDirectory()) throw new Error('Not a directory');
    if (server) throw new Error('Server already running');

    servingDir = path.resolve(dir);

    server = http.createServer(async (req, res) => {
        try {
            const rawUrlPath = (req.url || '/').split('?')[0];
            const decoded = decodeURIComponent(rawUrlPath);
            // Remove leading forward slashes (URL paths) before normalizing so this
            // behaves consistently on Windows where path.normalize will use backslashes.
            const withoutLeading = decoded.replace(/^\/+/, '');
            // Normalize to collapse any .. segments
            const safePath = path.normalize(withoutLeading);
            // Block obvious path traversal / absolute paths
            if (safePath.startsWith('..') || path.isAbsolute(safePath)) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                res.end('Bad request');
                return;
            }

            let filePath: string;
            let stats: any = null;
            if (!safePath || safePath === '.') {
                // root request -> serve index.html
                filePath = path.join(servingDir as string, 'index.html');
                stats = await fs.stat(filePath).catch(() => null);
            } else {
                filePath = path.join(servingDir as string, safePath);
                stats = await fs.stat(filePath).catch(() => null);
                if (!stats) {
                    // If not found, try appending index.html when path is a folder
                    filePath = path.join(servingDir as string, safePath, 'index.html');
                    stats = await fs.stat(filePath).catch(() => null);
                }
            }
            if (!stats || !stats.isFile()) {
                res.statusCode = 404;
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                res.end('Not found');
                return;
            }

            const ext = path.extname(filePath);
            const ctype = contentTypeFor(ext);
            res.statusCode = 200;
            res.setHeader('Content-Type', ctype);
            // Simple caching hints
            if (ext === '.html' || ext === '.htm') {
                res.setHeader('Cache-Control', 'no-store');
            } else {
                res.setHeader('Cache-Control', 'public, max-age=3600');
            }
            const stream = fsSync.createReadStream(filePath);
            stream.pipe(res);
            stream.on('error', (err) => {
                try { res.destroy(err); } catch { /* ignore */ }
            });
        } catch (e) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.end(String(e));
        }
    });

    return new Promise<{ ok: true; port: number; localUrl: string; lanUrl: string }>((resolve, reject) => {
        const onError = (err: any) => {
            // Clean up global server state to avoid leaving a stale reference
            try { server = null; servingDir = null; } catch { /* ignore */ }
            reject(err);
        };
        server!.on('error', onError);
        server!.listen(0, host, () => {
            // Remove the error listener now that listen succeeded
            try { server!.removeListener('error', onError); } catch { /* ignore */ }
            const addr = server!.address();
            let port = 0;
            if (addr && typeof addr === 'object') port = addr.port;
            const localUrl = `http://localhost:${port}/`;
            const lanIp = chooseLanAddress();
            const lanUrl = `http://${lanIp}:${port}/`;
            resolve({ ok: true, port, localUrl, lanUrl });
        });
    });
}

export async function stopStaticServer() {
    if (!server) return { ok: true, stopped: false };
    return new Promise<{ ok: boolean; stopped: boolean }>((resolve) => {
        const srv = server!;
        server = null;
        servingDir = null;
        srv.close((err) => {
            if (err) resolve({ ok: false, stopped: false });
            else resolve({ ok: true, stopped: true });
        });
    });
}

export function isServerRunning() {
    return !!server;
}
