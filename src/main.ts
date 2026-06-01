import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { json } from 'express';
import { AppModule } from './app.module';
import { createProxy } from './proxy.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  const authUrl = configService.get<string>('AUTH_SERVICE_URL')!;
  const userUrl = configService.get<string>('USER_SERVICE_URL')!;
  const serviceUrl = configService.get<string>('SERVICE_SERVICE_URL')!;

  // Body parser (must be before proxy)
  app.use(json({ limit: '10mb' }));

  // CORS
  app.enableCors({ origin: '*', credentials: true });

  // Proxy
  app.use(
    createProxy([
      { prefix: '/auth-docs', target: authUrl },
      { prefix: '/auth', target: authUrl },
      { prefix: '/users-docs', target: userUrl },
      { prefix: '/users', target: userUrl },
      { prefix: '/user-service-roles', target: userUrl },
      { prefix: '/services-docs', target: serviceUrl },
      { prefix: '/services', target: serviceUrl },
    ]),
  );

  const port = configService.get<number>('PORT', 8080);
  await app.listen(port);

  console.log(`\n🚀  Gateway running on http://localhost:${port}`);
  console.log(`📚  Swagger:`);
  console.log(`   Auth    → http://localhost:${port}/auth-docs`);
  console.log(`   Users   → http://localhost:${port}/users-docs`);
  console.log(`   Serv.   → http://localhost:${port}/services-docs`);
  console.log(`\n🔁  API routes:`);
  console.log(`   /auth/*              → ${authUrl}`);
  console.log(`   /users/*             → ${userUrl}`);
  console.log(`   /user-service-roles/* → ${userUrl}`);
  console.log(`   /services/*          → ${serviceUrl}\n`);
}

bootstrap();
