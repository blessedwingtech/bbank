import { Test, TestingModule } from '@nestjs/testing';
import { AccountService } from './account.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AccountStatus, AccountType, Role } from '@prisma/client';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('AccountService', () => {
  let service: AccountService;
  let prismaService: any;

  beforeEach(async () => {
    prismaService = {
      account: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<AccountService>(AccountService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create an account with zero balance and format BB-XXXXXXXX', async () => {
      prismaService.user.findUnique.mockResolvedValue({
        id: 1,
        username: 'client1',
        firstName: 'Jean',
        lastName: 'Dupont',
      });
      prismaService.account.findUnique.mockResolvedValue(null);
      prismaService.account.create.mockImplementation((args: any) => ({
        id: 10,
        ...args.data,
      }));

      const currentUser = { id: 1, username: 'client1', email: 'c@c.com', role: Role.user };
      const result = await service.create({ accountType: AccountType.checking }, currentUser);

      expect(result.accountNumber).toMatch(/^BB-\d{8}$/);
      expect(result.balance).toBe(0.0);
      expect(result.status).toBe(AccountStatus.active);
      expect(result.userId).toBe(1);
    });
  });

  describe('findById anti-IDOR', () => {
    it('should throw ForbiddenException if standard user accesses someone elses account', async () => {
      prismaService.account.findUnique.mockResolvedValue({
        id: 5,
        accountNumber: 'BB-11112222',
        userId: 99, // Owned by user 99
      });

      const currentUser = { id: 1, username: 'client1', email: 'c@c.com', role: Role.user };

      await expect(service.findById(5, currentUser)).rejects.toThrow(ForbiddenException);
    });

    it('should allow admin to access any account', async () => {
      prismaService.account.findUnique.mockResolvedValue({
        id: 5,
        accountNumber: 'BB-11112222',
        userId: 99,
      });

      const adminUser = { id: 1, username: 'admin', email: 'admin@bbank.com', role: Role.admin };
      const account = await service.findById(5, adminUser);
      expect(account.id).toBe(5);
    });
  });
});
