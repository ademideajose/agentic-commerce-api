import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('agent-api');
  await app.listen(3000);

  const url = await app.getUrl();
  console.log(`🚀 Agentic API running at ${url}/agent-api`);
}
bootstrap();
