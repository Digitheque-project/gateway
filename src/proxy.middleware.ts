import { Request, Response } from 'express';
import * as http from 'http';

export interface ProxyRoute {
  prefix: string;
  target: string;
}

export function createProxy(routes: ProxyRoute[]) {
  return (req: Request, res: Response, next: () => void) => {
    const route = routes.find((r) => req.path.startsWith(r.prefix));

    if (!route) {
      return next();
    }

    const targetUrl = new URL(route.target);
    const body = JSON.stringify(req.body ?? {});
    const headers = { ...req.headers } as Record<string, string | string[]>;

    delete headers['host'];

    const options: http.RequestOptions = {
      hostname: targetUrl.hostname,
      port: targetUrl.port,
      path: req.originalUrl,
      method: req.method,
      headers: {
        ...headers,
        ...(req.method !== 'GET' && req.method !== 'HEAD'
          ? { 'content-length': Buffer.byteLength(body).toString() }
          : {}),
      },
    };

    const proxyReq = http.request(options, (proxyRes) => {
      const chunks: Buffer[] = [];
      proxyRes.on('data', (chunk: Buffer) => chunks.push(chunk));
      proxyRes.on('end', () => {
        const raw = Buffer.concat(chunks);
        const contentType = proxyRes.headers['content-type'] ?? '';

        if (contentType.includes('application/json')) {
          try {
            const parsed = JSON.parse(raw.toString());
            res.status(proxyRes.statusCode ?? 200).json(parsed);
            return;
          } catch {
            // fall through to raw send
          }
        }

        res.status(proxyRes.statusCode ?? 200);
        for (const [key, value] of Object.entries(proxyRes.headers)) {
          if (value !== undefined) {
            res.setHeader(key, value);
          }
        }
        res.send(raw);
      });
    });

    proxyReq.on('error', (err) => {
      console.error(
        `Proxy error [${req.method} ${req.originalUrl}]:`,
        err.message,
      );
      res.status(502).json({
        statusCode: 502,
        message: `Cannot reach ${route.target}`,
      });
    });

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      proxyReq.write(body);
    }

    proxyReq.end();
  };
}
