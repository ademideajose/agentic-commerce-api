import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProductsModule } from './products/products.module';
import { AuthController } from './auth/auth.controller';
import { ApiKeyAuthGuard } from './auth/auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CheckoutController } from './checkouts.controller';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { existsSync } from 'fs';

// Function to find the correct public directory
function findPublicPath(): string {
  // In production on Render, we're in /opt/render/project/src/dist/src
  // The public files should be copied to /opt/render/project/src/dist/public

  const candidatePaths = [
    // Production: relative to current working directory
    join(process.cwd(), 'dist', 'public'),
    // Production: relative to the compiled src directory (where we are now)
    join(__dirname, '..', 'public'),
    // Development: relative to project root
    join(process.cwd(), 'public'),
    // Alternative: if assets are copied next to the src compilation
    join(__dirname, '..', '..', 'public'),
  ];

  console.log('🔍 Searching for public directory...');
  console.log('Current working directory:', process.cwd());
  console.log('__dirname:', __dirname);

  for (const path of candidatePaths) {
    console.log(`Checking: ${path}`);
    if (existsSync(path)) {
      const testFile = join(path, '.well-known', 'agent-commerce-openapi.json');
      console.log(`  Directory exists, checking for test file: ${testFile}`);
      if (existsSync(testFile)) {
        console.log(`✅ Found public directory with OpenAPI file: ${path}`);
        return path;
      } else {
        console.log(`  Directory exists but missing OpenAPI file`);
      }
    } else {
      console.log(`  Directory does not exist`);
    }
  }

  // Fallback
  const fallback = join(process.cwd(), 'dist', 'public');
  console.log(
    `⚠️  No valid public directory found, using fallback: ${fallback}`,
  );
  return fallback;
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ProductsModule,
    ServeStaticModule.forRoot({
      rootPath: findPublicPath(),
      serveRoot: '/agent-api',
      serveStaticOptions: {
        dotfiles: 'allow',
        index: false,
        fallthrough: false,
      },
    }),
  ],
  controllers: [AppController, AuthController, CheckoutController],
  providers: [AppService, ApiKeyAuthGuard],
})
export class AppModule {}
