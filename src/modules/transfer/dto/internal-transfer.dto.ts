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

export class InternalTransferDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsNotEmpty({ message: 'Le compte source est requis.' })
  sourceAccountId: number;

  @IsString()
  @IsNotEmpty({ message: 'Le numéro du compte destinataire est requis.' })
  @Length(5, 30, { message: 'Numéro de compte destinataire invalide.' })
  destinationAccountNumber: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive({ message: 'Le montant doit être positif.' })
  @Min(0.01, { message: 'Le montant minimum est de 0.01 €.' })
  amount: number;

  @IsOptional()
  @IsString()
  @Length(0, 255)
  description?: string;
}
