import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
} from 'class-validator';
import { InstitutionType } from '@prisma/client';
import { Type } from 'class-transformer';

export class UpdateSystemSettingDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  institutionName: string;

  @IsEnum(InstitutionType)
  institutionType: InstitutionType;

  @IsBoolean()
  enableMicrocredit: boolean;

  @IsBoolean()
  enableCooperative: boolean;

  @IsBoolean()
  enableTontine: boolean;

  @IsBoolean()
  enableStandardBank: boolean;

  @IsBoolean()
  enable2FAForTransfers: boolean;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  maxDailyTransferLimit: number;

  @IsString()
  @IsNotEmpty()
  @Length(1, 10)
  defaultCurrency: string;
}
