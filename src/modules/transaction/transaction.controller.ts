import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { TransactionService } from './transaction.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ParsePositiveIntPipe } from '../../common/pipes/parse-positive-int.pipe';
import { PrismaService } from '../../prisma/prisma.service';

@Controller()
export class TransactionController {
  constructor(
    private readonly transactionService: TransactionService,
    private readonly prisma: PrismaService,
  ) {}

  @Roles(Role.admin, Role.manager)
  @Get('transactions')
  async listAllTransactions(
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const transactions = await this.transactionService.findAll(user);
    const isHtmx = req.headers['hx-request'] === 'true';
    return res.render('transactions/list', {
      transactions,
      isHtmx,
      pageTitle: 'Toutes les transactions',
    });
  }

  @Get('accounts/:accountId/transactions')
  async listAccountTransactions(
    @Param('accountId', ParsePositiveIntPipe) accountId: number,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });
    const transactions = await this.transactionService.findByAccountId(accountId, user);
    const isHtmx = req.headers['hx-request'] === 'true';

    return res.render('transactions/list', {
      transactions,
      account,
      isHtmx,
      pageTitle: `Transactions - Compte ${account?.accountNumber || accountId}`,
    });
  }

  @Get('accounts/:accountId/transactions/create')
  async getCreateTransaction(
    @Param('accountId', ParsePositiveIntPipe) accountId: number,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });
    const isHtmx = req.headers['hx-request'] === 'true';

    return res.render('transactions/create', {
      account,
      accountId,
      isHtmx,
      pageTitle: 'Nouvelle transaction (Dépôt / Retrait)',
    });
  }

  @Post('accounts/:accountId/transactions')
  async postCreateTransaction(
    @Param('accountId', ParsePositiveIntPipe) accountId: number,
    @Body() dto: CreateTransactionDto,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const transaction = await this.transactionService.createTransaction(accountId, dto, user);
      if (req.flash) {
        req.flash(
          'success',
          `Transaction de ${dto.type === 'deposit' ? 'dépôt' : 'retrait'} de ${dto.amount.toFixed(2)} € exécutée avec succès (frais: ${Number(transaction.fee).toFixed(2)} €).`,
        );
      }
      const isHtmx = req.headers['hx-request'] === 'true';
      if (isHtmx) {
        res.setHeader('HX-Redirect', `/accounts/${accountId}`);
        return res.status(200).send();
      }
      return res.redirect(`/accounts/${accountId}`);
    } catch (err: any) {
      if (req.flash) {
        req.flash('error', err.message || 'Erreur lors de la transaction.');
      }
      const isHtmx = req.headers['hx-request'] === 'true';
      if (isHtmx) {
        res.setHeader('HX-Redirect', `/accounts/${accountId}/transactions/create`);
        return res.status(400).send();
      }
      return res.redirect(`/accounts/${accountId}/transactions/create`);
    }
  }
}
