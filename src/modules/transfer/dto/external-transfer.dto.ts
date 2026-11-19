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

export class ExternalTransferDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsNotEmpty({ message: 'Le compte source est requis.' })
  sourceAccountId: number;

  @IsString()
  @IsNotEmpty({ message: 'Le nom du bénéficiaire est requis.' })
  @Length(2, 100)
  beneficiaryName: string;

  @IsString()
  @IsNotEmpty({ message: "L'IBAN du bénéficiaire est requis." })
  @Length(10, 40)
  beneficiaryIban: string;

  @IsOptional()
  @IsString()
  @Length(8, 11)
  beneficiaryBic?: string;

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
