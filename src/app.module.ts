import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProductsModule } from './products/products.module';
import { AuthController } from './auth/auth.controller';
import { SuggestModule } from './suggest/suggest.module';

@Module({
  imports: [ProductsModule, ConfigModule.forRoot(), SuggestModule],
  controllers: [AppController, AuthController],
  providers: [AppService],
})
export class AppModule {}
