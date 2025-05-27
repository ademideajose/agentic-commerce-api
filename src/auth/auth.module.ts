// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { TokenStorageService } from './token-storage.service';
// PrismaModule is global, ConfigModule is global. No need to import ProductsModule here anymore.

@Module({
  imports: [], // Remove ProductsModule if AuthController no longer directly uses ProductsService
  controllers: [AuthController],
  providers: [TokenStorageService], // TokenStorageService uses PrismaService (global)
  exports: [TokenStorageService], // Export if other modules might need it
})
export class AuthModule {}
