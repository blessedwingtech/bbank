import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { InterestCalculationMethod } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateLoanProductDto {
  @IsString()
  @IsNotEmpty({ message: 'Le nom du produit de crédit est requis.' })
  @Length(2, 100)
  name: string;

  @IsOptional()
  @IsString()
  @Length(0, 255)
  description?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Min(0.1)
  @Max(100)
  interestRate: number; // e.g. 10.50%

  @IsEnum(InterestCalculationMethod)
  interestMethod: InterestCalculationMethod;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  minAmount: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  maxAmount: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  minDurationMonths: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  maxDurationMonths: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  penaltyRateDaily?: number;
}
