import { IsEnum, IsNotEmpty, IsOptional, IsPositive, IsInt } from 'class-validator';
import { AccountType } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateAccountDto {
  @IsEnum(AccountType, { message: 'Type de compte invalide (checking ou savings).' })
  @IsNotEmpty({ message: 'Le type de compte est requis.' })
  accountType: AccountType;

  // Optional: only admin/manager can specify userId. Normal users can only create for themselves.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  userId?: number;
}
