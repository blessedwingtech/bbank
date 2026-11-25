import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { GuaranteeType } from '@prisma/client';
import { Type } from 'class-transformer';

export class ApplyLoanDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  productId: number;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  accountId: number; // account for disbursement and repayment

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Min(50)
  amountRequested: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationMonths: number;

  @IsString()
  @IsNotEmpty({ message: 'Le motif de la demande est requis.' })
  @Length(5, 255)
  purpose: string;

  // Optional guarantee details
  @IsOptional()
  @IsEnum(GuaranteeType)
  guaranteeType?: GuaranteeType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  guaranteeValue?: number;

  @IsOptional()
  @IsString()
  @Length(0, 255)
  guaranteeDescription?: string;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  guarantorName?: string;

  @IsOptional()
  @IsString()
  @Length(0, 20)
  guarantorPhone?: string;
}
