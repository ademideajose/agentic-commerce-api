// src/prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super(); // Pass Prisma Client options if needed, e.g., logging
    console.log('PrismaService: Constructor called.');
  }

  async onModuleInit() {
    try {
      await this.$connect();
      console.log('PrismaService: Successfully connected to the database.');
    } catch (error) {
      console.error('PrismaService: FAILED to connect to the database.', error);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
