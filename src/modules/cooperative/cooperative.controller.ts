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
import { CooperativeService } from './cooperative.service';
import { BuySharesDto } from './dto/buy-shares.dto';
import { CreateTontineDto } from './dto/create-tontine.dto';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccountStatus, Role } from '@prisma/client';
import { ParsePositiveIntPipe } from '../../common/pipes/parse-positive-int.pipe';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('cooperative')
export class CooperativeController {
  constructor(
    private readonly coopService: CooperativeService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async getCooperativeDashboard(
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const data = await this.coopService.getOverview(user.id);
    const userAccounts = await this.prisma.account.findMany({
      where: { userId: user.id, status: AccountStatus.active },
      orderBy: { accountNumber: 'asc' },
    });

    const isHtmx = req.headers['hx-request'] === 'true';
    return res.render('cooperative/index', {
      ...data,
      userAccounts,
      isHtmx,
      pageTitle: 'Coopérative, Mutuelle & Tontines',
    });
  }

  @Post('shares/buy')
  async buyShares(
    @Body() dto: BuySharesDto,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      await this.coopService.buyShares(user.id, dto, user.username);
      if (req.flash) {
        req.flash('success', `Félicitations ! Vous avez acquis ${dto.shareCount} part(s) sociale(s).`);
      }
    } catch (err: any) {
      if (req.flash) req.flash('error', err.message || 'Erreur lors de la souscription des parts.');
    }

    const isHtmx = req.headers['hx-request'] === 'true';
    if (isHtmx) {
      res.setHeader('HX-Redirect', '/cooperative');
      return res.status(200).send();
    }
    return res.redirect('/cooperative');
  }

  @Roles(Role.admin, Role.manager)
  @Post('tontines')
  async createTontine(
    @Body() dto: CreateTontineDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      await this.coopService.createTontine(dto);
      if (req.flash) req.flash('success', 'Nouvelle tontine créée avec succès.');
    } catch (err: any) {
      if (req.flash) req.flash('error', err.message || 'Erreur lors de la création de la tontine.');
    }

    const isHtmx = req.headers['hx-request'] === 'true';
    if (isHtmx) {
      res.setHeader('HX-Redirect', '/cooperative');
      return res.status(200).send();
    }
    return res.redirect('/cooperative');
  }

  @Post('tontines/:id/join')
  async joinTontine(
    @Param('id', ParsePositiveIntPipe) id: number,
    @CurrentUser('id') userId: number,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      await this.coopService.joinTontine(id, userId);
      if (req.flash) req.flash('success', 'Vous avez rejoint la tontine avec succès.');
    } catch (err: any) {
      if (req.flash) req.flash('error', err.message || 'Erreur lors de l’inscription à la tontine.');
    }

    const isHtmx = req.headers['hx-request'] === 'true';
    if (isHtmx) {
      res.setHeader('HX-Redirect', '/cooperative');
      return res.status(200).send();
    }
    return res.redirect('/cooperative');
  }
}
