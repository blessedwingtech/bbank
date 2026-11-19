import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Length } from 'class-validator';
import { FeeType } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateFeeDto {
  @IsEnum(FeeType)
  @IsNotEmpty()
  type: FeeType;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  @IsOptional()
  @IsString()
  @Length(0, 255)
  description?: string;
}
