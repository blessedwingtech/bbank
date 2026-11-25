import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  Max,
  Min,
} from 'class-validator';
import { InterestCalculationMethod } from '@prisma/client';
import { Type } from 'class-transformer';

export class SimulateLoanDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Min(50)
  amount: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  durationMonths: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Min(0)
  @Max(100)
  annualRate: number;

  @IsOptional()
  @IsEnum(InterestCalculationMethod)
  method?: InterestCalculationMethod;
}
