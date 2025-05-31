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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ProductsModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, 'public'),
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
