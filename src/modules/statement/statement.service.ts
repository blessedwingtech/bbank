import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import PDFDocument from 'pdfkit';

export interface StatementFilter {
  startDate?: string;
  endDate?: string;
}

@Injectable()
export class StatementService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatementData(
    accountId: number,
    filter: StatementFilter,
    currentUser: CurrentUserPayload,
  ) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            firstName: true,
            lastName: true,
            address: true,
            phone: true,
          },
        },
      },
    });

    if (!account) {
      throw new NotFoundException(`Compte #${accountId} introuvable.`);
    }

    const isStaff = currentUser.role === Role.admin || currentUser.role === Role.manager;
    if (!isStaff && account.userId !== currentUser.id) {
      throw new ForbiddenException('Accès interdit : vous ne pouvez pas consulter ce relevé.');
    }

    const dateConditions: any = {};
    if (filter.startDate) {
      dateConditions.gte = new Date(filter.startDate);
    }
    if (filter.endDate) {
      // End of day
      const end = new Date(filter.endDate);
      end.setHours(23, 59, 59, 999);
      dateConditions.lte = end;
    }

    const whereClause: any = { accountId };
    if (filter.startDate || filter.endDate) {
      whereClause.createdAt = dateConditions;
    }

    const transactions = await this.prisma.transaction.findMany({
      where: whereClause,
      orderBy: { createdAt: 'asc' },
    });

    const fees = await this.prisma.fee.findMany({
      where: whereClause,
    });

    const totalFees = fees.reduce((sum, f) => sum + Number(f.amount), 0);
    const totalDeposits = transactions
      .filter((t) => t.type === 'deposit' || t.type === 'interest')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const totalWithdrawals = transactions
      .filter((t) => t.type === 'withdrawal')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const currentBalance = Number(account.balance);
    const closingBalance = transactions.length > 0
      ? Number(transactions[transactions.length - 1].balanceAfter)
      : currentBalance;
    const openingBalance = transactions.length > 0
      ? (transactions[0].type === 'deposit'
          ? Number(transactions[0].balanceAfter) - Number(transactions[0].amount)
          : Number(transactions[0].balanceAfter) + Number(transactions[0].amount) + Number(transactions[0].fee))
      : currentBalance;

    return {
      account,
      transactions,
      openingBalance,
      closingBalance,
      totalDeposits,
      totalWithdrawals,
      totalFees,
      filter,
    };
  }

  generatePdf(data: any): InstanceType<typeof PDFDocument> {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });

    // Header - Bank Information
    doc.fillColor('#1a365d')
      .fontSize(22)
      .text('B-Bank', 40, 40, { bold: true } as any);

    doc.fillColor('#4a5568')
      .fontSize(10)
      .text('Banque & Micro-Crédit Sécurisé', 40, 68)
      .text('10 Boulevard des Finances, 75008 Paris', 40, 80)
      .text('contact@bbank.com | www.bbank.com', 40, 92);

    // Document Title
    doc.fillColor('#2b6cb0')
      .fontSize(16)
      .text('RELEVÉ DE COMPTE BANCAIRE', 300, 40, { align: 'right' });

    doc.fillColor('#4a5568')
      .fontSize(10)
      .text(`Émis le : ${new Date().toLocaleDateString('fr-FR')}`, 300, 65, { align: 'right' })
      .text(`Compte : ${data.account.accountNumber} (${data.account.accountType.toUpperCase()})`, 300, 80, { align: 'right' })
      .text(`Titulaire : ${data.account.owner}`, 300, 95, { align: 'right' });

    doc.moveTo(40, 115).lineTo(555, 115).strokeColor('#cbd5e0').stroke();

    // Summary Box
    doc.rect(40, 130, 515, 65).fillAndStroke('#edf2f7', '#cbd5e0');
    doc.fillColor('#2d3748').fontSize(9);
    doc.text(`Solde Initial : ${data.openingBalance.toFixed(2)} €`, 55, 142);
    doc.text(`Total Dépôts / Crédits : +${data.totalDeposits.toFixed(2)} €`, 55, 158);
    doc.text(`Total Retraits / Débits : -${data.totalWithdrawals.toFixed(2)} €`, 55, 174);

    doc.text(`Total Frais de gestion : ${data.totalFees.toFixed(2)} €`, 300, 142);
    doc.fontSize(11).fillColor('#1a365d');
    doc.text(`Solde de Clôture : ${data.closingBalance.toFixed(2)} €`, 300, 165, { bold: true } as any);

    // Transactions Table Header
    let y = 220;
    doc.rect(40, y, 515, 20).fill('#2b6cb0');
    doc.fillColor('#ffffff').fontSize(9);
    doc.text('Date', 45, y + 5);
    doc.text('Description', 120, y + 5);
    doc.text('Type', 320, y + 5);
    doc.text('Montant', 380, y + 5);
    doc.text('Frais', 440, y + 5);
    doc.text('Solde', 495, y + 5);

    y += 25;
    doc.fillColor('#2d3748').fontSize(8);

    if (data.transactions.length === 0) {
      doc.text('Aucune opération enregistrée pour la période sélectionnée.', 45, y + 10);
    } else {
      for (const tx of data.transactions) {
        if (y > 750) {
          doc.addPage();
          y = 40;
        }

        const dateStr = new Date(tx.createdAt).toLocaleDateString('fr-FR');
        const desc = (tx.description || tx.type).substring(0, 35);
        const amountStr = `${tx.type === 'withdrawal' ? '-' : '+'}${Number(tx.amount).toFixed(2)} €`;
        const feeStr = `${Number(tx.fee).toFixed(2)} €`;
        const balStr = `${Number(tx.balanceAfter).toFixed(2)} €`;

        doc.text(dateStr, 45, y);
        doc.text(desc, 120, y);
        doc.text(tx.type, 320, y);
        doc.text(amountStr, 380, y);
        doc.text(feeStr, 440, y);
        doc.text(balStr, 495, y);

        y += 18;
        doc.moveTo(40, y - 4).lineTo(555, y - 4).strokeColor('#e2e8f0').stroke();
      }
    }

    // Footer
    const pageBottom = 780;
    doc.fillColor('#a0aec0').fontSize(8);
    doc.text(
      'B-Bank - Société de Micro-Crédit et Gestion Bancaire. Document certifié conforme généré automatiquement.',
      40,
      pageBottom,
      { align: 'center', width: 515 },
    );

    doc.end();
    return doc;
  }
}
