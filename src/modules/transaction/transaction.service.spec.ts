import { Test, TestingModule } from '@nestjs/testing';
import { TransactionService } from './transaction.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AccountStatus, Role, TransactionType } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('TransactionService', () => {
  let service: TransactionService;
  let prismaService: any;

  beforeEach(async () => {
    prismaService = {
      $transaction: jest.fn((callback) => callback(prismaService)),
      account: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      transaction: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      fee: {
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<TransactionService>(TransactionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTransaction - Deposit', () => {
    it('should process deposit and deduct 0.9% fee', async () => {
      prismaService.account.findUnique.mockResolvedValue({
        id: 1,
        balance: 1000.0,
        status: AccountStatus.active,
        userId: 1,
      });

      prismaService.account.update.mockResolvedValue({ id: 1, balance: 1099.1 });
      prismaService.transaction.create.mockImplementation((args: any) => ({
        id: 100,
        ...args.data,
      }));

      const currentUser = { id: 1, username: 'client1', email: 'c@c.com', role: Role.user };
      const result = await service.createTransaction(
        1,
        { type: TransactionType.deposit, amount: 100 },
        currentUser,
      );

      // 0.9% of 100 = 0.90 fee. Net deposit = 99.10. New balance = 1000 + 99.10 = 1099.10
      expect(result.fee).toBe(0.9);
      expect(result.balanceAfter).toBe(1099.1);
      expect(prismaService.fee.create).toHaveBeenCalled();
    });
  });

  describe('createTransaction - Withdrawal', () => {
    it('should process withdrawal and deduct 1.0% fee', async () => {
      prismaService.account.findUnique.mockResolvedValue({
        id: 1,
        balance: 1000.0,
        status: AccountStatus.active,
        userId: 1,
      });

      prismaService.transaction.create.mockImplementation((args: any) => ({
        id: 101,
        ...args.data,
      }));

      const currentUser = { id: 1, username: 'client1', email: 'c@c.com', role: Role.user };
      const result = await service.createTransaction(
        1,
        { type: TransactionType.withdrawal, amount: 200 },
        currentUser,
      );

      // 1% of 200 = 2.00 fee. Total deduction = 202.00. New balance = 1000 - 202 = 798.00
      expect(result.fee).toBe(2.0);
      expect(result.balanceAfter).toBe(798.0);
    });

    it('should throw BadRequestException if balance is insufficient', async () => {
      prismaService.account.findUnique.mockResolvedValue({
        id: 1,
        balance: 50.0, // Insufficient for 100 + 1
        status: AccountStatus.active,
        userId: 1,
      });

      const currentUser = { id: 1, username: 'client1', email: 'c@c.com', role: Role.user };

      await expect(
        service.createTransaction(
          1,
          { type: TransactionType.withdrawal, amount: 100 },
          currentUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if account is frozen', async () => {
      prismaService.account.findUnique.mockResolvedValue({
        id: 1,
        balance: 1000.0,
        status: AccountStatus.frozen,
        userId: 1,
      });

      const currentUser = { id: 1, username: 'client1', email: 'c@c.com', role: Role.user };

      await expect(
        service.createTransaction(
          1,
          { type: TransactionType.withdrawal, amount: 50 },
          currentUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
