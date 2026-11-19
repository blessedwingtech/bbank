import { Test, TestingModule } from '@nestjs/testing';
import { TransferService } from './transfer.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AccountStatus, Role, TransferStatus, TransferType } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('TransferService', () => {
  let service: TransferService;
  let prismaService: any;

  beforeEach(async () => {
    prismaService = {
      $transaction: jest.fn((callback) => callback(prismaService)),
      account: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      transfer: {
        create: jest.fn(),
      },
      transaction: {
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransferService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<TransferService>(TransferService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createInternalTransfer', () => {
    it('should transfer funds internally and update both balances atomically', async () => {
      // Source account
      prismaService.account.findUnique
        .mockResolvedValueOnce({
          id: 1,
          accountNumber: 'BB-11111111',
          owner: 'Sender',
          balance: 500.0,
          status: AccountStatus.active,
          userId: 1,
        })
        // Destination account
        .mockResolvedValueOnce({
          id: 2,
          accountNumber: 'BB-22222222',
          owner: 'Receiver',
          balance: 100.0,
          status: AccountStatus.active,
          userId: 2,
        });

      prismaService.transfer.create.mockImplementation((args: any) => ({
        id: 99,
        ...args.data,
      }));

      const currentUser = { id: 1, username: 'sender', email: 's@s.com', role: Role.user };
      const result = await service.createInternalTransfer(
        {
          sourceAccountId: 1,
          destinationAccountNumber: 'BB-22222222',
          amount: 150.0,
          description: 'Loyer',
        },
        currentUser,
      );

      expect(prismaService.account.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { balance: 350.0 }, // 500 - 150
      });

      expect(prismaService.account.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { balance: 250.0 }, // 100 + 150
      });

      expect(result.status).toBe(TransferStatus.completed);
      expect(result.type).toBe(TransferType.internal);
      expect(result.amount).toBe(150.0);
    });

    it('should throw BadRequestException if source balance is insufficient', async () => {
      prismaService.account.findUnique
        .mockResolvedValueOnce({
          id: 1,
          balance: 50.0, // Insufficient for 100
          status: AccountStatus.active,
          userId: 1,
        })
        .mockResolvedValueOnce({
          id: 2,
          accountNumber: 'BB-22222222',
          balance: 100.0,
          status: AccountStatus.active,
          userId: 2,
        });

      const currentUser = { id: 1, username: 'sender', email: 's@s.com', role: Role.user };

      await expect(
        service.createInternalTransfer(
          {
            sourceAccountId: 1,
            destinationAccountNumber: 'BB-22222222',
            amount: 100.0,
          },
          currentUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if source and destination are the same account', async () => {
      prismaService.account.findUnique
        .mockResolvedValueOnce({
          id: 1,
          accountNumber: 'BB-11111111',
          balance: 500.0,
          status: AccountStatus.active,
          userId: 1,
        })
        .mockResolvedValueOnce({
          id: 1, // Same ID!
          accountNumber: 'BB-11111111',
          balance: 500.0,
          status: AccountStatus.active,
          userId: 1,
        });

      const currentUser = { id: 1, username: 'sender', email: 's@s.com', role: Role.user };

      await expect(
        service.createInternalTransfer(
          {
            sourceAccountId: 1,
            destinationAccountNumber: 'BB-11111111',
            amount: 50.0,
          },
          currentUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
