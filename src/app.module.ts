import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProductsModule } from './products/products.module';
//import { AuthController } from './auth/auth.controller';

import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
//import { CheckoutController } from './checkouts.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ProductsModule,
    // CheckoutModule // You'll create and add this later
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
