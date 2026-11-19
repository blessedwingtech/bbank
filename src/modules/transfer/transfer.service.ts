import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InternalTransferDto } from './dto/internal-transfer.dto';
import { ExternalTransferDto } from './dto/external-transfer.dto';
import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { AccountStatus, Role, TransactionType, TransferStatus, TransferType } from '@prisma/client';

@Injectable()
export class TransferService {
  constructor(private readonly prisma: PrismaService) {}

  async createInternalTransfer(dto: InternalTransferDto, user: CurrentUserPayload) {
    if (dto.amount <= 0) {
      throw new BadRequestException('Le montant doit être supérieur à zéro.');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Fetch source account
      const sourceAccount = await tx.account.findUnique({
        where: { id: dto.sourceAccountId },
      });

      if (!sourceAccount) {
        throw new NotFoundException(`Compte source #${dto.sourceAccountId} introuvable.`);
      }

      const isStaff = user.role === Role.admin || user.role === Role.manager;
      if (!isStaff && sourceAccount.userId !== user.id) {
        throw new ForbiddenException('Accès interdit : vous ne pouvez pas transférer depuis ce compte.');
      }

      if (sourceAccount.status !== AccountStatus.active) {
        throw new BadRequestException('Opération impossible : le compte source est gelé ou fermé.');
      }

      // 2. Fetch destination account
      const destAccount = await tx.account.findUnique({
        where: { accountNumber: dto.destinationAccountNumber.trim() },
      });

      if (!destAccount) {
        throw new NotFoundException(`Compte destinataire ${dto.destinationAccountNumber} introuvable.`);
      }

      if (destAccount.id === sourceAccount.id) {
        throw new BadRequestException('Le compte source et le compte destinataire ne peuvent pas être identiques.');
      }

      if (destAccount.status !== AccountStatus.active) {
        throw new BadRequestException('Opération impossible : le compte destinataire est inactif ou gelé.');
      }

      // 3. Balance verification
      const sourceBalance = Number(sourceAccount.balance);
      if (sourceBalance < dto.amount) {
        throw new BadRequestException(
          `Solde insuffisant. Solde disponible: ${sourceBalance.toFixed(2)} €, montant demandé: ${dto.amount.toFixed(2)} €.`,
        );
      }

      const newSourceBalance = sourceBalance - dto.amount;
      const newDestBalance = Number(destAccount.balance) + dto.amount;

      // 4. Update balances
      await tx.account.update({
        where: { id: sourceAccount.id },
        data: { balance: newSourceBalance },
      });

      await tx.account.update({
        where: { id: destAccount.id },
        data: { balance: newDestBalance },
      });

      // 5. Create Transfer record
      const transfer = await tx.transfer.create({
        data: {
          amount: dto.amount,
          type: TransferType.internal,
          status: TransferStatus.completed,
          description: dto.description || `Virement interne vers ${destAccount.accountNumber}`,
          performedBy: user.username,
          completedAt: new Date(),
          sourceAccountId: sourceAccount.id,
          destinationAccountId: destAccount.id,
        },
      });

      // 6. Create transactions records for traceability
      await tx.transaction.create({
        data: {
          accountId: sourceAccount.id,
          amount: dto.amount,
          type: TransactionType.withdrawal,
          fee: 0,
          balanceAfter: newSourceBalance,
          description: `Virement émis vers ${destAccount.accountNumber} (${destAccount.owner})`,
          performedBy: user.username,
        },
      });

      await tx.transaction.create({
        data: {
          accountId: destAccount.id,
          amount: dto.amount,
          type: TransactionType.deposit,
          fee: 0,
          balanceAfter: newDestBalance,
          description: `Virement reçu de ${sourceAccount.accountNumber} (${sourceAccount.owner})`,
          performedBy: user.username,
        },
      });

      return transfer;
    });
  }

  async createExternalTransfer(dto: ExternalTransferDto, user: CurrentUserPayload) {
    if (dto.amount <= 0) {
      throw new BadRequestException('Le montant doit être supérieur à zéro.');
    }

    return this.prisma.$transaction(async (tx) => {
      const sourceAccount = await tx.account.findUnique({
        where: { id: dto.sourceAccountId },
      });

      if (!sourceAccount) {
        throw new NotFoundException(`Compte source #${dto.sourceAccountId} introuvable.`);
      }

      const isStaff = user.role === Role.admin || user.role === Role.manager;
      if (!isStaff && sourceAccount.userId !== user.id) {
        throw new ForbiddenException('Accès interdit : vous ne pouvez pas émettre un virement depuis ce compte.');
      }

      if (sourceAccount.status !== AccountStatus.active) {
        throw new BadRequestException('Opération impossible : le compte source est gelé ou fermé.');
      }

      const sourceBalance = Number(sourceAccount.balance);
      if (sourceBalance < dto.amount) {
        throw new BadRequestException(
          `Solde insuffisant. Solde disponible: ${sourceBalance.toFixed(2)} €, montant demandé: ${dto.amount.toFixed(2)} €.`,
        );
      }

      const newBalance = sourceBalance - dto.amount;

      // 1. Debit source account
      await tx.account.update({
        where: { id: sourceAccount.id },
        data: { balance: newBalance },
      });

      const externalDetails = JSON.stringify({
        beneficiaryName: dto.beneficiaryName,
        beneficiaryIban: dto.beneficiaryIban,
        beneficiaryBic: dto.beneficiaryBic || '',
      });

      // 2. Create pending transfer record
      const transfer = await tx.transfer.create({
        data: {
          amount: dto.amount,
          type: TransferType.external,
          status: TransferStatus.pending,
          externalDetails,
          description: dto.description || `Virement externe vers ${dto.beneficiaryName} (${dto.beneficiaryIban})`,
          performedBy: user.username,
          sourceAccountId: sourceAccount.id,
        },
      });

      // 3. Create transaction on source account
      await tx.transaction.create({
        data: {
          accountId: sourceAccount.id,
          amount: dto.amount,
          type: TransactionType.withdrawal,
          fee: 0,
          balanceAfter: newBalance,
          description: `Virement externe émis vers ${dto.beneficiaryName}`,
          performedBy: user.username,
        },
      });

      return transfer;
    });
  }

  async getHistory(user: CurrentUserPayload) {
    const isStaff = user.role === Role.admin || user.role === Role.manager;

    return this.prisma.transfer.findMany({
      where: isStaff
        ? {}
        : {
            OR: [
              { sourceAccount: { userId: user.id } },
              { destinationAccount: { userId: user.id } },
            ],
          },
      include: {
        sourceAccount: {
          select: { id: true, accountNumber: true, owner: true, userId: true },
        },
        destinationAccount: {
          select: { id: true, accountNumber: true, owner: true, userId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
