import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { AccountStatus, FeeType, Role, TransactionType } from '@prisma/client';
import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';

@Injectable()
export class TransactionService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: CurrentUserPayload) {
    const isStaff = user.role === Role.admin || user.role === Role.manager;
    return this.prisma.transaction.findMany({
      where: isStaff
        ? {}
        : {
            account: {
              userId: user.id,
            },
          },
      include: {
        account: {
          select: {
            id: true,
            accountNumber: true,
            owner: true,
            accountType: true,
            user: {
              select: { id: true, username: true, email: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async findByAccountId(accountId: number, user: CurrentUserPayload) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException(`Compte #${accountId} introuvable.`);
    }

    const isStaff = user.role === Role.admin || user.role === Role.manager;
    if (!isStaff && account.userId !== user.id) {
      throw new ForbiddenException('Accès interdit : ce compte ne vous appartient pas.');
    }

    return this.prisma.transaction.findMany({
      where: { accountId },
      include: {
        account: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createTransaction(
    accountId: number,
    dto: CreateTransactionDto,
    currentUser: CurrentUserPayload,
  ) {
    if (dto.amount <= 0) {
      throw new BadRequestException('Le montant doit être strictement supérieur à zéro.');
    }

    return this.prisma.$transaction(async (tx) => {
      const account = await tx.account.findUnique({
        where: { id: accountId },
      });

      if (!account) {
        throw new NotFoundException(`Compte #${accountId} introuvable.`);
      }

      const isStaff = currentUser.role === Role.admin || currentUser.role === Role.manager;
      if (!isStaff && account.userId !== currentUser.id) {
        throw new ForbiddenException('Accès interdit : vous ne pouvez pas effectuer d’opérations sur ce compte.');
      }

      if (account.status !== AccountStatus.active) {
        throw new BadRequestException(`Opération impossible : le compte est ${account.status === AccountStatus.frozen ? 'gelé' : 'fermé'}.`);
      }

      const currentBalance = Number(account.balance);
      let feeAmount = 0;
      let newBalance = currentBalance;
      let feeType: FeeType = FeeType.deposit_fee;

      if (dto.type === TransactionType.withdrawal) {
        // Withdrawal: fee is 1%
        feeAmount = Math.round(dto.amount * 0.01 * 100) / 100;
        feeType = FeeType.withdrawal_fee;
        const totalRequired = dto.amount + feeAmount;

        if (currentBalance < totalRequired) {
          throw new BadRequestException(
            `Solde insuffisant. Solde actuel: ${currentBalance.toFixed(2)} €, montant demandé: ${dto.amount.toFixed(2)} €, frais: ${feeAmount.toFixed(2)} € (total requis: ${totalRequired.toFixed(2)} €).`,
          );
        }

        newBalance = currentBalance - totalRequired;
      } else if (dto.type === TransactionType.deposit) {
        // Deposit: fee is 0.9%
        feeAmount = Math.round(dto.amount * 0.009 * 100) / 100;
        feeType = FeeType.deposit_fee;
        const netDeposit = dto.amount - feeAmount;
        newBalance = currentBalance + netDeposit;
      } else {
        throw new BadRequestException('Type de transaction non pris en charge manuellement.');
      }

      // 1. Update account balance
      await tx.account.update({
        where: { id: account.id },
        data: { balance: newBalance },
      });

      // 2. Record Transaction
      const transaction = await tx.transaction.create({
        data: {
          accountId: account.id,
          amount: dto.amount,
          type: dto.type,
          fee: feeAmount,
          balanceAfter: newBalance,
          description: dto.description || `${dto.type === TransactionType.withdrawal ? 'Retrait' : 'Dépôt'} d'espèces`,
          performedBy: currentUser.username,
        },
      });

      // 3. Record Fee if > 0
      if (feeAmount > 0) {
        await tx.fee.create({
          data: {
            accountId: account.id,
            amount: feeAmount,
            type: feeType,
            description: `Frais de ${dto.type === TransactionType.withdrawal ? 'retrait (1%)' : 'dépôt (0.9%)'} pour la transaction #${transaction.id}`,
          },
        });
      }

      return transaction;
    });
  }
}
