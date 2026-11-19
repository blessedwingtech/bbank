import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { TransactionType } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateTransactionDto {
  @IsEnum(TransactionType, { message: 'Type de transaction invalide (deposit ou withdrawal).' })
  @IsNotEmpty({ message: 'Le type de transaction est requis.' })
  type: TransactionType;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Le montant doit comporter au plus 2 décimales.' })
  @IsPositive({ message: 'Le montant doit être strictement supérieur à zéro.' })
  @Min(0.01, { message: 'Le montant minimum est de 0.01 €.' })
  amount: number;

  @IsOptional()
  @IsString()
  @Length(0, 255)
  description?: string;
}
