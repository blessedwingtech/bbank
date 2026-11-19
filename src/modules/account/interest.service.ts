import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { winstonLogger } from '../../config/winston.config';
import { AccountStatus, AccountType, TransactionType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class InterestService {
  constructor(private readonly prisma: PrismaService) {}

  // Run at 00:00 on the 1st of every month
  @Cron('0 0 1 * *')
  async handleMonthlyInterestCron() {
    winstonLogger.info('Cron job started: Calculating monthly savings interests...');
    const result = await this.calculateMonthlyInterests('SYSTEM_CRON');
    winstonLogger.info(`Monthly interests calculated: ${result.processedCount} accounts processed.`);
  }

  async calculateMonthlyInterests(triggeredBy: string) {
    const monthlyRate = parseFloat(process.env.SAVINGS_INTEREST_RATE || '0.005');

    // Retrieve active savings accounts with positive balance
    const savingsAccounts = await this.prisma.account.findMany({
      where: {
        accountType: AccountType.savings,
        status: AccountStatus.active,
        balance: { gt: 0 },
      },
    });

    let processedCount = 0;
    let totalInterestDistributed = 0;

    for (const account of savingsAccounts) {
      const balanceNum = Number(account.balance);
      const interestAmount = Math.round(balanceNum * monthlyRate * 100) / 100;

      if (interestAmount <= 0) continue;

      const newBalance = balanceNum + interestAmount;
      const newAccumulated = Number(account.accumulatedInterest) + interestAmount;

      await this.prisma.$transaction(async (tx) => {
        // Update account
        await tx.account.update({
          where: { id: account.id },
          data: {
            balance: newBalance,
            accumulatedInterest: newAccumulated,
          },
        });

        // Create transaction record
        await tx.transaction.create({
          data: {
            accountId: account.id,
            amount: interestAmount,
            type: TransactionType.interest,
            fee: 0,
            balanceAfter: newBalance,
            description: `Intérêts mensuels appliqués (${(monthlyRate * 100).toFixed(2)}%)`,
            performedBy: triggeredBy,
          },
        });
      });

      processedCount++;
      totalInterestDistributed += interestAmount;
    }

    return {
      processedCount,
      totalInterestDistributed,
      monthlyRate,
    };
  }
}
