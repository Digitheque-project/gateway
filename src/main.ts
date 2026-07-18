import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { createProxyMiddleware } from 'http-proxy-middleware';
import * as jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  const authUrl = configService.get<string>('AUTH_SERVICE_URL')!;
  const userUrl = configService.get<string>('USER_SERVICE_URL')!;
  const serviceUrl = configService.get<string>('SERVICE_SERVICE_URL')!;
  const chuUrl = configService.get<string>('CHU_SERVICE_URL')!;
  const cliniqueUrl = configService.get<string>('CLINIQUE_SERVICE_URL')!;
  const endoscopieUrl = configService.get<string>('ENDOSCOPIE_SERVICE_URL')!;
  const prescriptionUrl = configService.get<string>('PRESCRIPTION_SERVICE_URL')!;
  const eegUrl = configService.get<string>('EEG_SERVICE_URL')!;
  const anapathUrl = configService.get<string>('ANAPATH_SERVICE_URL')!;

  // CORS
  app.enableCors({ origin: '*', credentials: true });

  // JWT validation for external services (hors docs Swagger)
  const externalPaths = ['/clinique', '/endoscopie', '/prescription', '/eeg', '/anapath'];
  app.use((req: Request, res: Response, next: NextFunction) => {
    const isExternal = externalPaths.some((p) => req.path.startsWith(p));
    if (!isExternal) return next();
    if (req.path.includes('/docs')) return next();

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Token manquant' });
    }

    try {
      jwt.verify(authHeader.split(' ')[1], configService.get<string>('JWT_SECRET')!);
      next();
    } catch {
      return res.status(401).json({ message: 'Token invalide ou expiré' });
    }
  });

  // Proxy (pathFilter preserve l'URL complète, contrairement à app.use('/prefix', ...))
  app.use(
    createProxyMiddleware({
      target: authUrl,
      changeOrigin: true,
      pathFilter: (path) =>
        path.startsWith('/auth') ||
        path.startsWith('/roles') ||
        path.startsWith('/permissions') ||
        path.startsWith('/auth-docs'), 
    }),
  );

  app.use(
    createProxyMiddleware({
      target: userUrl,
      changeOrigin: true,
      pathFilter: (path) =>
        path.startsWith('/users') ||
        path.startsWith('/user-service-roles') ||
        path.startsWith('/users-docs'),
    }),
  );

  app.use(
    createProxyMiddleware({
      target: serviceUrl,
      changeOrigin: true,
      pathFilter: (path) =>
        path.startsWith('/services') || path.startsWith('/services-docs'),
    }),
  );

  app.use(
    createProxyMiddleware({
      target: chuUrl,
      changeOrigin: true,
      pathFilter: (path) =>
        path.startsWith('/chu') || path.startsWith('/prise-en-charge'),
    }),
  );

  app.use(
    createProxyMiddleware({
      target: cliniqueUrl,
      changeOrigin: true,
      pathFilter: (path) =>
        path.startsWith('/clinique') || path.startsWith('/clinique/api/docs'),
    }),
  );

  app.use(
    createProxyMiddleware({
      target: endoscopieUrl,
      changeOrigin: true,
      pathFilter: (path) =>
        path.startsWith('/endoscopie') || path.startsWith('/endoscopie/api/docs'),
    }),
  );

  app.use(
    createProxyMiddleware({
      target: prescriptionUrl,
      changeOrigin: true,
      pathFilter: (path) =>
        path.startsWith('/prescription') || path.startsWith('/prescriptions/api/docs'),
    }),
  );

  app.use(
    createProxyMiddleware({
      target: eegUrl,
      changeOrigin: true,
      pathFilter: (path) =>
        path.startsWith('/eeg') || path.startsWith('/eeg/api/docs'),
    }),
  );

  app.use(
    createProxyMiddleware({
      target: anapathUrl,
      changeOrigin: true,
      pathFilter: (path) =>
        path.startsWith('/api/anapath') || path.startsWith('/api/docs'),
    }),
  );

  const port = configService.get<number>('PORT', 8080);
  await app.listen(port);

  console.log(`\n🚀  Gateway running on http://localhost:${port}`);
  console.log(`📚  Swagger:`);
  console.log(`   http://localhost:${port}/auth-docs`);
  console.log(`   http://localhost:${port}/users-docs`);
  console.log(`   http://localhost:${port}/services-docs`);
  console.log(`   http://localhost:${port}/chu-docs`);
  console.log(`   ${cliniqueUrl}/clinique/api/docs`);
  console.log(`   ${endoscopieUrl}/endoscopie/api/docs`);
  console.log(`   ${prescriptionUrl}/prescription/api/docs`);
  console.log(`   ${eegUrl}/eeg/api/docs`);
  console.log(`   ${anapathUrl}/anapath/api/docs`);
  console.log(`\n🔁  API:`);
  console.log(`   /auth/*              → ${authUrl}`);
  console.log(`   /users/*, /users-docs → ${userUrl}`);
  console.log(`   /services/*          → ${serviceUrl}`);
  console.log(`   /chu/*               → ${chuUrl}`);
  console.log(`   /clinique/*          → ${cliniqueUrl}`);
  console.log(`   /endoscopie/*        → ${endoscopieUrl}`);
  console.log(`   /prescription/*      → ${prescriptionUrl}`);
  console.log(`   /eeg/*               → ${eegUrl}`);
  console.log(`   /anapath/*           → ${anapathUrl}`);
}

bootstrap();
