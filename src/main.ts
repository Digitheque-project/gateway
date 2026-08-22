import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { createProxyMiddleware } from 'http-proxy-middleware';
import * as jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import {
  SERVICES,
  ServiceEntry,
  docsPathOf,
  watchPathsOf,
} from './config/services.registry';

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

  // Contrôle JWT pour les services marqués requiresAuth dans le registre.
  // Les chemins contenant '/docs' (pages Swagger) restent publics.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const target = active.find(
      ({ service }) =>
        service.requiresAuth &&
        service.paths.some((prefix) => req.path.startsWith(prefix)),
    );
    if (!target || req.path.includes('/docs')) return next();

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
  for (const { service, baseUrl } of active) {
    const watched = watchPathsOf(service);
    app.use(
      createProxyMiddleware({
        target: baseUrl,
        changeOrigin: true,
        pathFilter: (path) =>
          watched.some((prefix) => path.startsWith(prefix)),
      }),
    );
  }

  const port = configService.get<number>('PORT', 8080);
  await app.listen(port);

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
