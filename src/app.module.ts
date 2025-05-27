import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProductsModule } from './products/products.module';
import { AuthController } from './auth/auth.controller';

@Module({
  imports: [ProductsModule, ConfigModule.forRoot()],
  controllers: [AppController, AuthController],
  providers: [AppService],
})
export class AppModule {}
