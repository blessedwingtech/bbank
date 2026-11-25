import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateSystemSettingDto } from './dto/update-system-setting.dto';
import { InstitutionType } from '@prisma/client';
import { winstonLogger } from '../../config/winston.config';

@Injectable()
export class SystemSettingService implements OnModuleInit {
  private cachedSettings: any = null;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.getSettings();
  }

  async getSettings() {
    try {
      let settings = await this.prisma.systemSetting.findFirst();
      if (!settings) {
        settings = await this.prisma.systemSetting.create({
          data: {
            institutionName: 'B-Bank Pro',
            institutionType: InstitutionType.microfinance,
            enableMicrocredit: true,
            enableCooperative: true,
            enableTontine: true,
            enableStandardBank: true,
            enable2FAForTransfers: false,
            maxDailyTransferLimit: 5000.0,
            defaultCurrency: 'EUR',
          },
        });
      }
      this.cachedSettings = settings;
      return settings;
    } catch (err) {
      winstonLogger.warn('Unable to load SystemSetting from DB, using defaults:', err);
      return {
        institutionName: 'B-Bank Pro',
        institutionType: 'microfinance',
        enableMicrocredit: true,
        enableCooperative: true,
        enableTontine: true,
        enableStandardBank: true,
        enable2FAForTransfers: false,
        maxDailyTransferLimit: 5000.0,
        defaultCurrency: 'EUR',
      };
    }
  }

  async updateSettings(dto: UpdateSystemSettingDto) {
    let settings = await this.prisma.systemSetting.findFirst();
    if (!settings) {
      settings = await this.prisma.systemSetting.create({
        data: dto,
      });
    } else {
      settings = await this.prisma.systemSetting.update({
        where: { id: settings.id },
        data: dto,
      });
    }
    this.cachedSettings = settings;
    return settings;
  }
}
