import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LoanCalculatorService } from './loan-calculator.service';
import { CreateLoanProductDto } from './dto/create-loan-product.dto';
import { ApplyLoanDto } from './dto/apply-loan.dto';
import { SimulateLoanDto } from './dto/simulate-loan.dto';
import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import {
  AccountStatus,
  InterestCalculationMethod,
  LoanStatus,
  Role,
  ScheduleStatus,
  TransactionType,
} from '@prisma/client';
import { Cron } from '@nestjs/schedule';
import { winstonLogger } from '../../config/winston.config';

@Injectable()
export class LoanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: LoanCalculatorService,
  ) {}

  async getProducts() {
    return this.prisma.loanProduct.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async createProduct(dto: CreateLoanProductDto) {
    if (dto.minAmount > dto.maxAmount) {
      throw new BadRequestException('Le montant minimum ne peut pas excéder le montant maximum.');
    }
    if (dto.minDurationMonths > dto.maxDurationMonths) {
      throw new BadRequestException('La durée minimale ne peut pas excéder la durée maximale.');
    }

    return this.prisma.loanProduct.create({
      data: {
        name: dto.name,
        description: dto.description,
        interestRate: dto.interestRate,
        interestMethod: dto.interestMethod,
        minAmount: dto.minAmount,
        maxAmount: dto.maxAmount,
        minDurationMonths: dto.minDurationMonths,
        maxDurationMonths: dto.maxDurationMonths,
        penaltyRateDaily: dto.penaltyRateDaily || 0.05,
        isActive: true,
      },
    });
  }

  simulate(dto: SimulateLoanDto) {
    return this.calculator.calculateLoan(
      dto.amount,
      dto.durationMonths,
      dto.annualRate,
      dto.method || InterestCalculationMethod.declining_balance,
    );
  }

  async findAll(user: CurrentUserPayload) {
    const isStaff = user.role === Role.admin || user.role === Role.manager;
    return this.prisma.loan.findMany({
      where: isStaff ? {} : { userId: user.id },
      include: {
        user: { select: { id: true, username: true, email: true, firstName: true, lastName: true } },
        product: true,
        account: { select: { id: true, accountNumber: true, balance: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: number, user: CurrentUserPayload) {
    const loan = await this.prisma.loan.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, username: true, email: true, firstName: true, lastName: true, phone: true } },
        product: true,
        account: true,
        schedules: { orderBy: { installmentNumber: 'asc' } },
        guarantees: true,
      },
    });

    if (!loan) {
      throw new NotFoundException(`Dossier de crédit #${id} introuvable.`);
    }

    const isStaff = user.role === Role.admin || user.role === Role.manager;
    if (!isStaff && loan.userId !== user.id) {
      throw new ForbiddenException('Accès interdit : ce dossier de crédit ne vous appartient pas.');
    }

    return loan;
  }

  async apply(userId: number, dto: ApplyLoanDto) {
    const product = await this.prisma.loanProduct.findUnique({
      where: { id: dto.productId },
    });
    if (!product || !product.isActive) {
      throw new NotFoundException('Produit de crédit introuvable ou inactif.');
    }

    const minAmount = Number(product.minAmount);
    const maxAmount = Number(product.maxAmount);
    if (dto.amountRequested < minAmount || dto.amountRequested > maxAmount) {
      throw new BadRequestException(
        `Le montant demandé doit être compris entre ${minAmount.toFixed(2)} € et ${maxAmount.toFixed(2)} €.`,
      );
    }

    if (dto.durationMonths < product.minDurationMonths || dto.durationMonths > product.maxDurationMonths) {
      throw new BadRequestException(
        `La durée doit être comprise entre ${product.minDurationMonths} et ${product.maxDurationMonths} mois.`,
      );
    }

    const account = await this.prisma.account.findUnique({
      where: { id: dto.accountId },
    });
    if (!account || account.userId !== userId) {
      throw new BadRequestException('Compte bancaire invalide ou non autorisé.');
    }
    if (account.status !== AccountStatus.active) {
      throw new BadRequestException('Le compte bancaire sélectionné est gelé ou inactif.');
    }

    // Simulation to compute projected metrics
    const simulation = this.calculator.calculateLoan(
      dto.amountRequested,
      dto.durationMonths,
      Number(product.interestRate),
      product.interestMethod,
    );

    const randomDigits = Math.floor(10000000 + Math.random() * 90000000);
    const loanNumber = `LN-${randomDigits}`;

    const loan = await this.prisma.loan.create({
      data: {
        loanNumber,
        amountRequested: dto.amountRequested,
        amountApproved: dto.amountRequested,
        durationMonths: dto.durationMonths,
        interestRate: product.interestRate,
        interestMethod: product.interestMethod,
        totalInterest: simulation.totalInterest,
        totalRepayable: simulation.totalRepayable,
        monthlyPayment: simulation.monthlyPayment,
        status: LoanStatus.submitted,
        purpose: dto.purpose,
        userId,
        accountId: dto.accountId,
        productId: dto.productId,
      },
    });

    if (dto.guaranteeType && dto.guaranteeValue) {
      await this.prisma.loanGuarantee.create({
        data: {
          loanId: loan.id,
          type: dto.guaranteeType,
          value: dto.guaranteeValue,
          description: dto.guaranteeDescription || 'Garantie déclarée',
          guarantorName: dto.guarantorName || null,
          guarantorPhone: dto.guarantorPhone || null,
        },
      });
    }

    return loan;
  }

  async approve(loanId: number, reviewer: CurrentUserPayload) {
    const loan = await this.prisma.loan.findUnique({ where: { id: loanId } });
    if (!loan) throw new NotFoundException('Dossier de crédit introuvable.');

    if (loan.status !== LoanStatus.submitted && loan.status !== LoanStatus.under_review) {
      throw new BadRequestException(`Ce dossier ne peut pas être approuvé (statut actuel: ${loan.status}).`);
    }

    return this.prisma.loan.update({
      where: { id: loanId },
      data: {
        status: LoanStatus.approved,
        amountApproved: loan.amountRequested,
      },
    });
  }

  async reject(loanId: number, reason: string, reviewer: CurrentUserPayload) {
    const loan = await this.prisma.loan.findUnique({ where: { id: loanId } });
    if (!loan) throw new NotFoundException('Dossier de crédit introuvable.');

    return this.prisma.loan.update({
      where: { id: loanId },
      data: {
        status: LoanStatus.rejected,
        rejectionReason: reason || 'Non spécifié',
      },
    });
  }

  async disburse(loanId: number, currentUser: CurrentUserPayload) {
    return this.prisma.$transaction(async (tx) => {
      const loan = await tx.loan.findUnique({
        where: { id: loanId },
        include: { account: true, product: true },
      });

      if (!loan) throw new NotFoundException('Dossier de crédit introuvable.');
      if (loan.status !== LoanStatus.approved) {
        throw new BadRequestException('Seul un prêt approuvé peut être débloqué.');
      }

      const disburseAmount = Number(loan.amountApproved || loan.amountRequested);
      const currentBalance = Number(loan.account.balance);
      const newBalance = currentBalance + disburseAmount;

      // 1. Credit borrower's account
      await tx.account.update({
        where: { id: loan.accountId },
        data: { balance: newBalance },
      });

      // 2. Create disbursement transaction
      await tx.transaction.create({
        data: {
          accountId: loan.accountId,
          amount: disburseAmount,
          type: TransactionType.loan_disbursement,
          fee: 0,
          balanceAfter: newBalance,
          description: `Déblocage du micro-crédit réf. ${loan.loanNumber}`,
          performedBy: currentUser.username,
        },
      });

      // 3. Generate repayment schedule
      const calculation = this.calculator.calculateLoan(
        disburseAmount,
        loan.durationMonths,
        Number(loan.interestRate),
        loan.interestMethod,
        new Date(),
      );

      for (const inst of calculation.schedule) {
        await tx.loanRepaymentSchedule.create({
          data: {
            loanId: loan.id,
            installmentNumber: inst.installmentNumber,
            dueDate: inst.dueDate,
            principalAmount: inst.principalAmount,
            interestAmount: inst.interestAmount,
            totalDue: inst.totalDue,
            amountPaid: 0,
            penaltyAmount: 0,
            status: ScheduleStatus.pending,
          },
        });
      }

      // 4. Update loan status to disbursed
      return tx.loan.update({
        where: { id: loan.id },
        data: {
          status: LoanStatus.disbursed,
          disbursedAt: new Date(),
          totalInterest: calculation.totalInterest,
          totalRepayable: calculation.totalRepayable,
          monthlyPayment: calculation.monthlyPayment,
        },
      });
    });
  }

  async repayInstallment(loanId: number, scheduleId: number, currentUser: CurrentUserPayload) {
    return this.prisma.$transaction(async (tx) => {
      const schedule = await tx.loanRepaymentSchedule.findUnique({
        where: { id: scheduleId },
        include: { loan: { include: { account: true } } },
      });

      if (!schedule || schedule.loanId !== loanId) {
        throw new NotFoundException('Échéance de remboursement introuvable.');
      }

      if (schedule.status === ScheduleStatus.paid) {
        throw new BadRequestException('Cette échéance est déjà réglée.');
      }

      const totalToPay = Number(schedule.totalDue) + Number(schedule.penaltyAmount) - Number(schedule.amountPaid);
      const currentBalance = Number(schedule.loan.account.balance);

      if (currentBalance < totalToPay) {
        throw new BadRequestException(
          `Solde insuffisant pour régler l'échéance. Solde disponible: ${currentBalance.toFixed(2)} €, montant requis: ${totalToPay.toFixed(2)} €.`,
        );
      }

      const newBalance = currentBalance - totalToPay;

      // 1. Debit account
      await tx.account.update({
        where: { id: schedule.loan.accountId },
        data: { balance: newBalance },
      });

      // 2. Record transaction
      await tx.transaction.create({
        data: {
          accountId: schedule.loan.accountId,
          amount: totalToPay,
          type: TransactionType.loan_repayment,
          fee: 0,
          balanceAfter: newBalance,
          description: `Remboursement échéance #${schedule.installmentNumber} du prêt ${schedule.loan.loanNumber}`,
          performedBy: currentUser.username,
        },
      });

      // 3. Update schedule
      await tx.loanRepaymentSchedule.update({
        where: { id: schedule.id },
        data: {
          amountPaid: Number(schedule.totalDue) + Number(schedule.penaltyAmount),
          status: ScheduleStatus.paid,
          paidAt: new Date(),
        },
      });

      // 4. Check if all installments for this loan are paid
      const unpaidCount = await tx.loanRepaymentSchedule.count({
        where: {
          loanId: schedule.loanId,
          status: { not: ScheduleStatus.paid },
        },
      });

      if (unpaidCount === 0) {
        await tx.loan.update({
          where: { id: schedule.loanId },
          data: {
            status: LoanStatus.repaid,
            repaidAt: new Date(),
          },
        });
      }

      return { success: true, remainingBalance: newBalance };
    });
  }

  // Daily cron: detects overdue schedules and calculates penalties
  @Cron('0 1 * * *')
  async handleOverdueCron() {
    winstonLogger.info('Micro-credit Cron: Checking overdue installments...');
    const now = new Date();

    const overdueSchedules = await this.prisma.loanRepaymentSchedule.findMany({
      where: {
        status: { in: [ScheduleStatus.pending, ScheduleStatus.partially_paid] },
        dueDate: { lt: now },
      },
      include: { loan: { include: { product: true } } },
    });

    for (const schedule of overdueSchedules) {
      const dailyPenaltyRate = Number(schedule.loan.product.penaltyRateDaily || 0.05) / 100;
      const principalRemaining = Number(schedule.principalAmount);
      const additionalPenalty = Math.round(principalRemaining * dailyPenaltyRate * 100) / 100;

      await this.prisma.loanRepaymentSchedule.update({
        where: { id: schedule.id },
        data: {
          status: ScheduleStatus.overdue,
          penaltyAmount: Number(schedule.penaltyAmount) + additionalPenalty,
        },
      });
    }

    winstonLogger.info(`Overdue schedules processed: ${overdueSchedules.length}`);
  }
}
