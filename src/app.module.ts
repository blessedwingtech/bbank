import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { appConfig } from './config/app.config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { AccountModule } from './modules/account/account.module';
import { TransactionModule } from './modules/transaction/transaction.module';
import { TransferModule } from './modules/transfer/transfer.module';
import { FeeModule } from './modules/fee/fee.module';
import { StatementModule } from './modules/statement/statement.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { AuthGuard } from './common/guards/auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { SerializeInterceptor } from './common/interceptors/serialize.interceptor';
import { SessionLocalsMiddleware } from './common/middleware/session-locals.middleware';
import { AuditLogMiddleware } from './common/middleware/audit-log.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('security.throttleTtl', 60) * 1000,
          limit: config.get<number>('security.throttleLimit', 10),
        },
      ],
    }),
    PrismaModule,
    AuthModule,
    UserModule,
    AccountModule,
    TransactionModule,
    TransferModule,
    FeeModule,
    StatementModule,
    AuditLogModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: SerializeInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SessionLocalsMiddleware, AuditLogMiddleware)
      .forRoutes('*');
  }
}
