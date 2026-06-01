import { Request, Response } from 'express';
import * as http from 'http';
import * as https from 'https';

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

    const headers = {
      ...req.headers,
    } as Record<string, string | string[]>;

    delete headers.host;

    const options: http.RequestOptions = {
      protocol: targetUrl.protocol,
      hostname: targetUrl.hostname,
      port:
        targetUrl.port ||
        (targetUrl.protocol === 'https:' ? 443 : 80),
      path: req.originalUrl,
      method: req.method,
      headers: {
        ...headers,
        ...(req.method !== 'GET' && req.method !== 'HEAD'
          ? {
              'content-length': Buffer.byteLength(body).toString(),
            }
          : {}),
      },
    };

    // Choix automatique HTTP / HTTPS
    const client =
      targetUrl.protocol === 'https:' ? https : http;

    const proxyReq = client.request(options, (proxyRes) => {
      const chunks: Buffer[] = [];

      proxyRes.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      proxyRes.on('end', () => {
        const raw = Buffer.concat(chunks);

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
        `Proxy error [${req.method} ${req.originalUrl}]`,
        err,
      );

      res.status(502).json({
        statusCode: 502,
        message: `Cannot reach ${route.target}`,
        error: err.message,
      });
    });

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      proxyReq.write(body);
    }

    proxyReq.end();
  };
}