import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BuySharesDto } from './dto/buy-shares.dto';
import { CreateTontineDto } from './dto/create-tontine.dto';
import { TransactionType } from '@prisma/client';

@Injectable()
export class CooperativeService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(userId: number) {
    const [userShares, totalShareAgg, tontines] = await Promise.all([
      this.prisma.cooperativeShare.findMany({
        where: { userId },
        orderBy: { purchasedAt: 'desc' },
      }),
      this.prisma.cooperativeShare.aggregate({
        _sum: { shareCount: true, totalAmount: true },
      }),
      this.prisma.tontine.findMany({
        include: {
          members: {
            include: { user: { select: { id: true, username: true, firstName: true, lastName: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const userTotalShares = userShares.reduce((sum, s) => sum + s.shareCount, 0);
    const userTotalInvested = userShares.reduce((sum, s) => sum + Number(s.totalAmount), 0);

    return {
      userShares,
      userTotalShares,
      userTotalInvested,
      coopStats: {
        totalSharesIssued: totalShareAgg._sum.shareCount || 0,
        totalCapitalMobilized: Number(totalShareAgg._sum.totalAmount || 0),
      },
      tontines,
    };
  }

  async buyShares(userId: number, dto: BuySharesDto, username: string) {
    const nominalValue = 50.0; // 50 € par part sociale
    const totalCost = dto.shareCount * nominalValue;

    return this.prisma.$transaction(async (tx) => {
      const account = await tx.account.findUnique({
        where: { id: dto.accountId },
      });

      if (!account || account.userId !== userId) {
        throw new BadRequestException('Compte bancaire invalide ou non autorisé.');
      }

      const balance = Number(account.balance);
      if (balance < totalCost) {
        throw new BadRequestException(
          `Solde insuffisant pour souscrire ${dto.shareCount} parts sociales (${totalCost.toFixed(2)} € requis, solde actuel: ${balance.toFixed(2)} €).`,
        );
      }

      const newBalance = balance - totalCost;

      // 1. Debit account
      await tx.account.update({
        where: { id: account.id },
        data: { balance: newBalance },
      });

      // 2. Record transaction
      await tx.transaction.create({
        data: {
          accountId: account.id,
          amount: totalCost,
          type: TransactionType.withdrawal,
          fee: 0,
          balanceAfter: newBalance,
          description: `Souscription de ${dto.shareCount} parts sociales mutuelle (50 € / part)`,
          performedBy: username,
        },
      });

      // 3. Create cooperative share
      return tx.cooperativeShare.create({
        data: {
          userId,
          shareCount: dto.shareCount,
          nominalValue,
          totalAmount: totalCost,
        },
      });
    });
  }

  async createTontine(dto: CreateTontineDto) {
    return this.prisma.tontine.create({
      data: {
        name: dto.name,
        description: dto.description,
        contributionAmount: dto.contributionAmount,
        frequency: dto.frequency,
        totalRounds: dto.totalRounds,
      },
    });
  }

  async joinTontine(tontineId: number, userId: number) {
    const tontine = await this.prisma.tontine.findUnique({
      where: { id: tontineId },
      include: { members: true },
    });

    if (!tontine) throw new NotFoundException('Tontine introuvable.');

    if (tontine.members.length >= tontine.totalRounds) {
      throw new BadRequestException('Cette tontine a déjà atteint son nombre maximal de membres.');
    }

    const alreadyJoined = tontine.members.some((m) => m.userId === userId);
    if (alreadyJoined) {
      throw new BadRequestException('Vous êtes déjà inscrit dans cette tontine.');
    }

    const nextOrder = tontine.members.length + 1;

    return this.prisma.tontineMember.create({
      data: {
        tontineId,
        userId,
        turnOrder: nextOrder,
      },
    });
  }
}
