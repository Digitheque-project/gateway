import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { createProxyMiddleware } from 'http-proxy-middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  const authUrl = configService.get<string>('AUTH_SERVICE_URL')!;
  const userUrl = configService.get<string>('USER_SERVICE_URL')!;
  const serviceUrl = configService.get<string>('SERVICE_SERVICE_URL')!;
  const chuUrl = configService.get<string>('CHU_SERVICE_URL')!;

  // CORS
  app.enableCors({ origin: '*', credentials: true });

  // Proxy (pathFilter preserve l'URL complète, contrairement à app.use('/prefix', ...))
  app.use(
    createProxyMiddleware({
      target: authUrl,
      changeOrigin: true,
      pathFilter: (path) =>
        path.startsWith('/auth') ||
        path.startsWith('/roles') ||
        path.startsWith('/permissions'),
    }),
  );

  app.use(
    createProxyMiddleware({
      target: userUrl,
      changeOrigin: true,
      pathFilter: (path) =>
        path.startsWith('/users') || path.startsWith('/user-service-roles'),
    }),
  );

  app.use(
    createProxyMiddleware({
      target: serviceUrl,
      changeOrigin: true,
      pathFilter: (path) => path.startsWith('/services'),
    }),
  );

  app.use(
    createProxyMiddleware({
      target: chuUrl,
      changeOrigin: true,
      pathFilter: (path) => path.startsWith('/chu'),
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
  console.log(`\n🔁  API:`);
  console.log(`   /auth/*              → ${authUrl}`);
  console.log(`   /users/*, /users-docs → ${userUrl}`);
  console.log(`   /services/*          → ${serviceUrl}`);
  console.log(`   /chu/*               → ${chuUrl}\n`);
}

bootstrap();
