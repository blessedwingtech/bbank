import { Test, TestingModule } from '@nestjs/testing';
import { SystemSettingService } from './system-setting.service';
import { PrismaService } from '../../prisma/prisma.service';
import { InstitutionType } from '@prisma/client';

describe('SystemSettingService', () => {
  let service: SystemSettingService;
  let prismaService: any;

  beforeEach(async () => {
    prismaService = {
      systemSetting: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemSettingService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<SystemSettingService>(SystemSettingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSettings', () => {
    it('should return existing settings from database', async () => {
      const mockSettings = {
        id: 1,
        institutionName: 'B-Bank Pro',
        institutionType: InstitutionType.microfinance,
        enableMicrocredit: true,
        enableCooperative: true,
        enableTontine: true,
        enableStandardBank: true,
      };
      prismaService.systemSetting.findFirst.mockResolvedValue(mockSettings);

      const result = await service.getSettings();

      expect(result).toEqual(mockSettings);
      expect(prismaService.systemSetting.findFirst).toHaveBeenCalled();
    });

    it('should create default settings if none exist', async () => {
      prismaService.systemSetting.findFirst.mockResolvedValue(null);
      const createdSettings = {
        id: 1,
        institutionName: 'B-Bank Pro',
        institutionType: InstitutionType.microfinance,
        enableMicrocredit: true,
        enableCooperative: true,
        enableTontine: true,
        enableStandardBank: true,
        enable2FAForTransfers: false,
        maxDailyTransferLimit: 5000.0,
        defaultCurrency: 'EUR',
      };
      prismaService.systemSetting.create.mockResolvedValue(createdSettings);

      const result = await service.getSettings();

      expect(prismaService.systemSetting.create).toHaveBeenCalled();
      expect(result).toEqual(createdSettings);
    });
  });

  describe('updateSettings', () => {
    it('should update existing settings', async () => {
      const existingSettings = { id: 1, institutionName: 'B-Bank Pro' };
      prismaService.systemSetting.findFirst.mockResolvedValue(existingSettings);
      const updatedSettings = {
        ...existingSettings,
        institutionName: 'Mutuelle Épargne & Crédit',
        enableTontine: false,
      };
      prismaService.systemSetting.update.mockResolvedValue(updatedSettings);

      const result = await service.updateSettings({
        institutionName: 'Mutuelle Épargne & Crédit',
        enableTontine: false,
      } as any);

      expect(prismaService.systemSetting.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          institutionName: 'Mutuelle Épargne & Crédit',
          enableTontine: false,
        },
      });
      expect(result.institutionName).toBe('Mutuelle Épargne & Crédit');
    });
  });
});
