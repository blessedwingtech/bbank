import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { TransferService } from './transfer.service';
import { InternalTransferDto } from './dto/internal-transfer.dto';
import { ExternalTransferDto } from './dto/external-transfer.dto';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AccountStatus } from '@prisma/client';

@Controller('transfers')
export class TransferController {
  constructor(
    private readonly transferService: TransferService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async getTransferPage(
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const isStaff = user.role === 'admin' || user.role === 'manager';
    const userAccounts = await this.prisma.account.findMany({
      where: isStaff ? { status: AccountStatus.active } : { userId: user.id, status: AccountStatus.active },
      orderBy: { accountNumber: 'asc' },
    });

    const isHtmx = req.headers['hx-request'] === 'true';
    return res.render('transfers/create', {
      userAccounts,
      isHtmx,
      pageTitle: 'Effectuer un virement bancaire',
    });
  }

  @Post('internal')
  async postInternalTransfer(
    @Body() dto: InternalTransferDto,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      await this.transferService.createInternalTransfer(dto, user);
      if (req.flash) {
        req.flash(
          'success',
          `Virement interne de ${dto.amount.toFixed(2)} € exécuté avec succès vers le compte ${dto.destinationAccountNumber}.`,
        );
      }
      const isHtmx = req.headers['hx-request'] === 'true';
      if (isHtmx) {
        res.setHeader('HX-Redirect', '/transfers/history');
        return res.status(200).send();
      }
      return res.redirect('/transfers/history');
    } catch (err: any) {
      if (req.flash) req.flash('error', err.message || 'Erreur lors du virement interne.');
      const isHtmx = req.headers['hx-request'] === 'true';
      if (isHtmx) {
        res.setHeader('HX-Redirect', '/transfers');
        return res.status(400).send();
      }
      return res.redirect('/transfers');
    }
  }

  @Post('external')
  async postExternalTransfer(
    @Body() dto: ExternalTransferDto,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      await this.transferService.createExternalTransfer(dto, user);
      if (req.flash) {
        req.flash(
          'success',
          `Virement externe de ${dto.amount.toFixed(2)} € initié avec succès vers ${dto.beneficiaryName} (statut : En attente).`,
        );
      }
      const isHtmx = req.headers['hx-request'] === 'true';
      if (isHtmx) {
        res.setHeader('HX-Redirect', '/transfers/history');
        return res.status(200).send();
      }
      return res.redirect('/transfers/history');
    } catch (err: any) {
      if (req.flash) req.flash('error', err.message || 'Erreur lors du virement externe.');
      const isHtmx = req.headers['hx-request'] === 'true';
      if (isHtmx) {
        res.setHeader('HX-Redirect', '/transfers');
        return res.status(400).send();
      }
      return res.redirect('/transfers');
    }
  }

  @Get('history')
  async getTransferHistory(
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const transfers = await this.transferService.getHistory(user);
    const isHtmx = req.headers['hx-request'] === 'true';
    return res.render('transfers/history', {
      transfers,
      isHtmx,
      pageTitle: 'Historique des virements',
    });
  }
}
