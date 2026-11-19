import { AccountStatus, AccountType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export class AccountResponseDto {
  id: number;
  accountNumber: string;
  owner: string;
  accountType: AccountType;
  balance: Decimal | number;
  accumulatedInterest: Decimal | number;
  status: AccountStatus;
  createdAt: Date;
  updatedAt: Date;
  userId: number;
}
