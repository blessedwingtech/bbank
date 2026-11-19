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
import { AccountService } from './account.service';
import { InterestService } from './interest.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ParsePositiveIntPipe } from '../../common/pipes/parse-positive-int.pipe';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('accounts')
export class AccountController {
  constructor(
    private readonly accountService: AccountService,
    private readonly interestService: InterestService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async listAccounts(
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const accounts = await this.accountService.findAll(user);
    const isHtmx = req.headers['hx-request'] === 'true';
    return res.render('accounts/list', {
      accounts,
      isHtmx,
      pageTitle: 'Comptes bancaires',
    });
  }

  @Get('create')
  async getCreateAccount(
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const isStaff = user.role === Role.admin || user.role === Role.manager;
    let allUsers: any[] = [];
    if (isStaff) {
      allUsers = await this.prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, username: true, email: true, firstName: true, lastName: true },
        orderBy: { username: 'asc' },
      });
    }

    const isHtmx = req.headers['hx-request'] === 'true';
    return res.render('accounts/create', {
      allUsers,
      isStaff,
      isHtmx,
      pageTitle: 'Ouvrir un nouveau compte',
    });
  }

  @Post()
  async postCreateAccount(
    @Body() dto: CreateAccountDto,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const account = await this.accountService.create(dto, user);
      if (req.flash) req.flash('success', `Compte ${account.accountNumber} créé avec succès !`);
      const isHtmx = req.headers['hx-request'] === 'true';
      if (isHtmx) {
        res.setHeader('HX-Redirect', `/accounts/${account.id}`);
        return res.status(200).send();
      }
      return res.redirect(`/accounts/${account.id}`);
    } catch (err: any) {
      if (req.flash) req.flash('error', err.message || 'Erreur lors de la création du compte.');
      return res.redirect('/accounts/create');
    }
  }

  @Get(':id')
  async getAccountDetails(
    @Param('id', ParsePositiveIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const account = await this.accountService.findById(id, user);
    const isHtmx = req.headers['hx-request'] === 'true';
    return res.render('accounts/details', {
      account,
      isHtmx,
      pageTitle: `Compte ${account.accountNumber}`,
    });
  }

  @Roles(Role.admin)
  @Post(':id/freeze')
  async freezeAccount(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      await this.accountService.freeze(id);
      if (req.flash) req.flash('success', 'Le compte a été gelé avec succès.');
    } catch (err: any) {
      if (req.flash) req.flash('error', err.message || 'Erreur lors du gel du compte.');
    }
    const isHtmx = req.headers['hx-request'] === 'true';
    if (isHtmx) {
      res.setHeader('HX-Redirect', `/accounts/${id}`);
      return res.status(200).send();
    }
    return res.redirect(`/accounts/${id}`);
  }

  @Roles(Role.admin)
  @Post(':id/unfreeze')
  async unfreezeAccount(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      await this.accountService.unfreeze(id);
      if (req.flash) req.flash('success', 'Le compte a été réactivé avec succès.');
    } catch (err: any) {
      if (req.flash) req.flash('error', err.message || 'Erreur lors de la réactivation du compte.');
    }
    const isHtmx = req.headers['hx-request'] === 'true';
    if (isHtmx) {
      res.setHeader('HX-Redirect', `/accounts/${id}`);
      return res.status(200).send();
    }
    return res.redirect(`/accounts/${id}`);
  }
}
