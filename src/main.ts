import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import { ValidationPipe } from '@nestjs/common';
import { TokenStorageService } from './auth/token-storage.service';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('agent-api');

  const tokenStore = app.get(TokenStorageService);

  /* Dynamic CORS */
  app.enableCors({
    origin: (origin, cb) => {
      // 1. Server-to-server / Postman (no Origin header)
      if (!origin) return cb(null, true);

      // 2. Ask the DB whether this storefront is installed
      tokenStore
        .isKnownStorefront(origin)
        .then((ok) => cb(null, ok))
        .catch((err) => {
          console.error('CORS check failed:', err);
          cb(err, false); // default-deny on error
        });
    },
    methods: 'GET,POST,OPTIONS',
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Shopify-Storefront-Access-Token',
    ],
  });

  /* (Optional) DTO validation */
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  /* 3. Pick up the port from the host environment or default to 3000 */
  const port = process.env.PORT || 3000;
  await app.listen(port);

  const url = await app.getUrl();
  console.log(`🚀 Agentic API running at ${url}/agent-api`);
}
bootstrap();
