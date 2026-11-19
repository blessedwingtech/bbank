import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardData(user: CurrentUserPayload) {
    const isStaff = user.role === Role.admin || user.role === Role.manager;

    if (isStaff) {
      // 1. Staff Statistics
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [
        totalUsers,
        totalAccounts,
        activeAccounts,
        frozenAccounts,
        monthlyTransactionsCount,
        monthlyTransactionsVolume,
        recentTransactions,
        recentTransfers,
        totalBalanceAggregate,
      ] = await Promise.all([
        this.prisma.user.count({ where: { isActive: true } }),
        this.prisma.account.count(),
        this.prisma.account.count({ where: { status: 'active' } }),
        this.prisma.account.count({ where: { status: 'frozen' } }),
        this.prisma.transaction.count({
          where: { createdAt: { gte: firstDayOfMonth } },
        }),
        this.prisma.transaction.aggregate({
          where: { createdAt: { gte: firstDayOfMonth } },
          _sum: { amount: true, fee: true },
        }),
        this.prisma.transaction.findMany({
          take: 7,
          orderBy: { createdAt: 'desc' },
          include: { account: true },
        }),
        this.prisma.transfer.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: { sourceAccount: true, destinationAccount: true },
        }),
        this.prisma.account.aggregate({
          _sum: { balance: true, accumulatedInterest: true },
        }),
      ]);

      return {
        isStaff: true,
        stats: {
          totalUsers,
          totalAccounts,
          activeAccounts,
          frozenAccounts,
          monthlyTransactionsCount,
          monthlyVolume: Number(monthlyTransactionsVolume._sum.amount || 0),
          monthlyFees: Number(monthlyTransactionsVolume._sum.fee || 0),
          totalVaultBalance: Number(totalBalanceAggregate._sum.balance || 0),
          totalInterestGiven: Number(totalBalanceAggregate._sum.accumulatedInterest || 0),
        },
        recentTransactions,
        recentTransfers,
      };
    } else {
      // 2. Client Statistics
      const accounts = await this.prisma.account.findMany({
        where: { userId: user.id },
        include: {
          _count: { select: { transactions: true } },
        },
        orderBy: { createdAt: 'asc' },
      });

      const totalBalance = accounts.reduce((acc, curr) => acc + Number(curr.balance), 0);
      const totalAccumulatedInterest = accounts.reduce(
        (acc, curr) => acc + Number(curr.accumulatedInterest),
        0,
      );

      const accountIds = accounts.map((a) => a.id);

      const recentTransactions = await this.prisma.transaction.findMany({
        where: { accountId: { in: accountIds } },
        take: 7,
        orderBy: { createdAt: 'desc' },
        include: { account: true },
      });

      const recentTransfers = await this.prisma.transfer.findMany({
        where: {
          OR: [
            { sourceAccountId: { in: accountIds } },
            { destinationAccountId: { in: accountIds } },
          ],
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { sourceAccount: true, destinationAccount: true },
      });

      return {
        isStaff: false,
        accounts,
        totalBalance,
        totalAccumulatedInterest,
        recentTransactions,
        recentTransfers,
      };
    }
  }
}
