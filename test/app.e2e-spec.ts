import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { join } from 'path';

describe('AppController (e2e)', () => {
  let app: NestExpressApplication;

  const mockPrismaService = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
    account: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      count: jest.fn().mockResolvedValue(2),
      aggregate: jest.fn().mockResolvedValue({ _sum: { balance: 1000, accumulatedInterest: 10 } }),
    },
    transaction: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0, fee: 0 } }),
    },
    transfer: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    app.useGlobalFilters(new HttpExceptionFilter());
    app.setBaseViewsDir(join(process.cwd(), 'views'));
    app.setViewEngine('ejs');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET / should redirect to /dashboard', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(302)
      .expect('Location', '/dashboard');
  });

  it('GET /dashboard without session should redirect to /auth/login (Unauthorized protection)', () => {
    return request(app.getHttpServer())
      .get('/dashboard')
      .expect(302)
      .expect('Location', '/auth/login');
  });

  it('GET /auth/login should return 200 with login form', () => {
    return request(app.getHttpServer())
      .get('/auth/login')
      .expect(200);
  });

  it('GET /auth/register should return 200 with registration form', () => {
    return request(app.getHttpServer())
      .get('/auth/register')
      .expect(200);
  });
});
