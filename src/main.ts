import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { compterTrafic, rapportTrafic } from './trafic';
import * as jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import {
  SERVICES,
  ServiceEntry,
  docsPathOf,
  watchPathsOf,
  pathMatchesPrefix,
} from './config/services.registry';
import { KeepAliveService } from './keep-alive.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  // Résolution des URLs de base depuis les variables d'environnement.
  // Un service dont la variable est absente est ignoré (avec un avertissement)
  // au lieu de faire échouer les requêtes au moment du proxy.
  const resolved = SERVICES.map((service) => ({
    service,
    baseUrl: configService.get<string>(service.urlEnv),
  }));
  const missing = resolved.filter((entry) => !entry.baseUrl);
  if (missing.length > 0) {
    console.warn(
      `⚠️  Variables d'URL manquantes, services ignorés : ${missing
        .map((entry) => entry.service.urlEnv)
        .join(', ')}`,
    );
  }
  const active = resolved.filter(
    (entry): entry is { service: ServiceEntry; baseUrl: string } =>
      !!entry.baseUrl,
  );

  // CORS
  app.enableCors({ origin: '*', credentials: true });

  // Totaux de trafic (qui interroge la passerelle, et combien) : GET /stats/trafic.
  app.use(compterTrafic);
  app.use('/stats/trafic', rapportTrafic);

  // Une tentative de connexion annonce une séance de travail : on réveille
  // toute la plateforme en arrière-plan (la requête de connexion continue
  // normalement vers le service d'authentification, sans attendre).
  const keepAlive = app.get(KeepAliveService);
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (req.method === 'POST' && pathMatchesPrefix(req.path, '/auth/login')) {
      keepAlive.wakeAllInBackground();
    }
    next();
  });

  // Connexion : un refus passager du service d'authentification — 429 du
  // pare-feu de l'hébergeur (toutes les connexions sortent par la même adresse),
  // 502/503/504 pendant son réveil — est réessayé ici, quelques secondes plus
  // tard, au lieu d'être renvoyé à l'agent (« Trop de tentatives », bloqué).
  const auth = active.find(({ service }) => service.urlEnv === 'AUTH_SERVICE_URL');
  if (auth) {
    const ATTENTES_MS = [2000, 4000, 8000, 12000];
    const PASSAGERS = [429, 502, 503, 504];
    app.use(async (req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'POST' || !pathMatchesPrefix(req.path, '/auth/login')) return next();
      try {
        const morceaux: Buffer[] = [];
        for await (const m of req) morceaux.push(Buffer.from(m as Buffer));
        const corps = Buffer.concat(morceaux);
        const url = `${auth.baseUrl.replace(/\/$/, '')}${req.originalUrl}`;
        let reponse: Awaited<ReturnType<typeof fetch>> | null = null;
        for (let essai = 0; ; essai++) {
          reponse = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': String(req.headers['content-type'] ?? 'application/json') },
            body: corps,
            signal: AbortSignal.timeout(60000),
          }).catch(() => null);
          if ((reponse && !PASSAGERS.includes(reponse.status)) || essai >= ATTENTES_MS.length) break;
          console.warn(
            `Connexion : réponse ${reponse?.status ?? 'absente'} de l'authentification, nouvel essai dans ${ATTENTES_MS[essai] / 1000} s`,
          );
          await new Promise((ok) => setTimeout(ok, ATTENTES_MS[essai]));
        }
        if (!reponse) {
          res.status(503).json({ message: "Service d'authentification injoignable, réessayez dans un instant" });
          return;
        }
        res
          .status(reponse.status)
          .type(reponse.headers.get('content-type') ?? 'application/json')
          .send(await reponse.text());
      } catch {
        res.status(502).json({ message: 'Connexion impossible, réessayez dans un instant' });
      }
    });
  }

  // Contrôle JWT pour les services marqués requiresAuth dans le registre.
  // Les chemins contenant '/docs' (pages Swagger) restent publics.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const target = active.find(
      ({ service }) =>
        service.requiresAuth &&
        service.paths.some((prefix) => pathMatchesPrefix(req.path, prefix)),
    );
    if (!target || req.path.includes('/docs')) return next();
    if (target.service.publicPaths?.some((prefix) => pathMatchesPrefix(req.path, prefix))) return next();

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Token manquant' });
    }

    const token = authHeader.split(' ')[1];

    // Jeton de service partagé : appels serveur-à-serveur (ex. notifyOurService,
    // synchronisation de rôles) qui n'ont structurellement aucun JWT utilisateur
    // à transmettre — même mécanisme que celui déjà utilisé par les backends
    // protégés eux-mêmes (JwtGuard) pour leurs appels internes.
    const serviceToken = configService.get<string>('SERVICE_API_TOKEN');
    if (serviceToken && token.trim() === serviceToken.trim()) {
      return next();
    }

    try {
      jwt.verify(token, configService.get<string>('JWT_SECRET')!);
      next();
    } catch {
      return res.status(401).json({ message: 'Token invalide ou expiré' });
    }
  });

  // Un proxy par service du registre : chemins API + chemin de la doc Swagger.
  // (pathFilter preserve l'URL complète, contrairement à app.use('/prefix', ...))
  // Pour les services ws:true (ex. Notification), on garde aussi une
  // référence au proxy pour relayer manuellement les requêtes d'upgrade
  // HTTP (WebSocket) — http-proxy-middleware ne les intercepte pas tout
  // seul via app.use(), il faut les brancher explicitement sur le serveur
  // HTTP sous-jacent (cf. plus bas).
  const wsProxies: Array<{ service: ServiceEntry; proxy: ReturnType<typeof createProxyMiddleware> }> = [];
  for (const { service, baseUrl } of active) {
    const watched = watchPathsOf(service);
    const proxy = createProxyMiddleware({
      target: baseUrl,
      changeOrigin: true,
      ws: service.ws,
      pathFilter: (path) =>
        watched.some((prefix) => pathMatchesPrefix(path, prefix)),
    });
    app.use(proxy);
    if (service.ws) wsProxies.push({ service, proxy });
  }

  const port = configService.get<number>('PORT', 8080);
  const httpServer = await app.listen(port);

  // Requêtes d'upgrade HTTP (WebSocket) : app.use() ne les voit jamais (elles
  // ne passent pas par la chaîne de middlewares Express), donc on les
  // relaie manuellement au bon proxy en comparant le chemin réel de la
  // requête à celui des services ws:true.
  httpServer.on('upgrade', (req: Request, socket: import('net').Socket, head: Buffer) => {
    const match = wsProxies.find(({ service }) =>
      watchPathsOf(service).some((prefix) => pathMatchesPrefix(req.url ?? '', prefix)),
    );
    if (match) {
      (match.proxy as unknown as { upgrade: (req: Request, socket: import('net').Socket, head: Buffer) => void }).upgrade(req, socket, head);
    } else {
      socket.destroy();
    }
  });

  // Table de routage générée depuis le registre.
  console.log(`\n🚀  Gateway running on http://localhost:${port}`);
  console.log(`📚  Swagger (via la gateway) :`);
  for (const { service } of active) {
    console.log(`   http://localhost:${port}${docsPathOf(service)}`);
  }
  console.log(`\n🔁  API :`);
  for (const { service, baseUrl } of active) {
    console.log(`   ${watchPathsOf(service).join(', ')}  →  ${baseUrl}`);
  }
}

bootstrap();
