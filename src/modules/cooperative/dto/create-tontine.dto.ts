import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTontineDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  name: string;

  @IsOptional()
  @IsString()
  @Length(0, 255)
  description?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Min(10)
  contributionAmount: number;

  @IsString()
  @IsNotEmpty()
  frequency: string; // e.g. "mensuelle"

  @Type(() => Number)
  @IsInt()
  @Min(2)
  totalRounds: number;
}
