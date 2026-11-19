import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { winstonLogger } from '../config/winston.config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      winstonLogger.info('Prisma connected to database successfully.');
    } catch (error) {
      winstonLogger.error('Prisma connection error:', error);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    winstonLogger.info('Prisma disconnected from database.');
  }
}
