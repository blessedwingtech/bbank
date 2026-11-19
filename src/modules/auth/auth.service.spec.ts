import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: any;

  beforeEach(async () => {
    prismaService = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      account: {
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user and hash their password', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);
      prismaService.user.create.mockImplementation((args: any) => ({
        id: 1,
        ...args.data,
      }));
      prismaService.account.create.mockResolvedValue({ id: 10 });

      const dto = {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'Password123!',
        firstName: 'John',
        lastName: 'Doe',
      };

      const result = await service.register(dto);

      expect(prismaService.user.create).toHaveBeenCalled();
      const callData = prismaService.user.create.mock.calls[0][0].data;
      expect(callData.password).not.toBe('Password123!');
      const match = await bcrypt.compare('Password123!', callData.password);
      expect(match).toBe(true);
      expect(result.username).toBe('newuser');
      expect(result.email).toBe('newuser@example.com');
    });

    it('should throw BadRequestException if email already exists', async () => {
      prismaService.user.findUnique.mockResolvedValueOnce({ id: 1, email: 'exist@example.com' });

      await expect(
        service.register({
          username: 'unique',
          email: 'exist@example.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('login', () => {
    it('should login successfully with correct credentials', async () => {
      const hashedPassword = await bcrypt.hash('Secret123!', 10);
      prismaService.user.findUnique.mockResolvedValue({
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        password: hashedPassword,
        role: Role.user,
        isActive: true,
      });

      const result = await service.login({
        email: 'test@example.com',
        password: 'Secret123!',
      });

      expect(result.id).toBe(1);
      expect(result.username).toBe('testuser');
      expect((result as any).password).toBeUndefined();
    });

    it('should throw UnauthorizedException on wrong password', async () => {
      const hashedPassword = await bcrypt.hash('Secret123!', 10);
      prismaService.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        password: hashedPassword,
        isActive: true,
      });

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user is not found', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'nonexistent@example.com',
          password: 'Secret123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
