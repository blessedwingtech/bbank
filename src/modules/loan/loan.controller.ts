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
import { LoanService } from './loan.service';
import { CreateLoanProductDto } from './dto/create-loan-product.dto';
import { ApplyLoanDto } from './dto/apply-loan.dto';
import { SimulateLoanDto } from './dto/simulate-loan.dto';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccountStatus, Role } from '@prisma/client';
import { ParsePositiveIntPipe } from '../../common/pipes/parse-positive-int.pipe';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('loans')
export class LoanController {
  constructor(
    private readonly loanService: LoanService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async listLoans(
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const loans = await this.loanService.findAll(user);
    const isHtmx = req.headers['hx-request'] === 'true';

    return res.render('loans/list', {
      loans,
      isHtmx,
      pageTitle: 'Dossiers de Micro-Crédit & Prêts',
    });
  }

  @Get('simulate')
  async getSimulatePage(@Req() req: Request, @Res() res: Response) {
    const products = await this.loanService.getProducts();
    const isHtmx = req.headers['hx-request'] === 'true';

    return res.render('loans/simulate', {
      products,
      isHtmx,
      pageTitle: 'Simulateur d’Amortissement de Crédit',
    });
  }

  @Post('simulate')
  async postSimulate(@Body() dto: SimulateLoanDto, @Res() res: Response) {
    const result = this.loanService.simulate(dto);
    return res.render('loans/partials/simulation-result', { result });
  }

  @Get('apply')
  async getApplyPage(
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const products = await this.loanService.getProducts();
    const accounts = await this.prisma.account.findMany({
      where: { userId: user.id, status: AccountStatus.active },
      orderBy: { accountNumber: 'asc' },
    });

    const isHtmx = req.headers['hx-request'] === 'true';
    return res.render('loans/apply', {
      products,
      accounts,
      isHtmx,
      pageTitle: 'Demander un Micro-Crédit',
    });
  }

  @Post('apply')
  async postApply(
    @Body() dto: ApplyLoanDto,
    @CurrentUser('id') userId: number,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const loan = await this.loanService.apply(userId, dto);
      if (req.flash) {
        req.flash('success', `Votre demande de prêt réf. ${loan.loanNumber} a été soumise avec succès.`);
      }
      const isHtmx = req.headers['hx-request'] === 'true';
      if (isHtmx) {
        res.setHeader('HX-Redirect', `/loans/${loan.id}`);
        return res.status(200).send();
      }
      return res.redirect(`/loans/${loan.id}`);
    } catch (err: any) {
      if (req.flash) req.flash('error', err.message || 'Erreur lors de la soumission du crédit.');
      const isHtmx = req.headers['hx-request'] === 'true';
      if (isHtmx) {
        res.setHeader('HX-Redirect', '/loans/apply');
        return res.status(400).send();
      }
      return res.redirect('/loans/apply');
    }
  }

  @Roles(Role.admin)
  @Get('products')
  async getProductsPage(@Req() req: Request, @Res() res: Response) {
    const products = await this.loanService.getProducts();
    const isHtmx = req.headers['hx-request'] === 'true';

    return res.render('loans/products', {
      products,
      isHtmx,
      pageTitle: 'Configuration des Produits de Crédit',
    });
  }

  @Roles(Role.admin)
  @Post('products')
  async createProduct(
    @Body() dto: CreateLoanProductDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      await this.loanService.createProduct(dto);
      if (req.flash) req.flash('success', 'Produit de crédit créé avec succès.');
    } catch (err: any) {
      if (req.flash) req.flash('error', err.message || 'Erreur lors de la création du produit.');
    }
    const isHtmx = req.headers['hx-request'] === 'true';
    if (isHtmx) {
      res.setHeader('HX-Redirect', '/loans/products');
      return res.status(200).send();
    }
    return res.redirect('/loans/products');
  }

  @Get(':id')
  async getLoanDetails(
    @Param('id', ParsePositiveIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const loan = await this.loanService.findById(id, user);
    const isStaff = user.role === Role.admin || user.role === Role.manager;
    const isHtmx = req.headers['hx-request'] === 'true';

    return res.render('loans/details', {
      loan,
      isStaff,
      isHtmx,
      pageTitle: `Dossier de Crédit ${loan.loanNumber}`,
    });
  }

  @Roles(Role.admin, Role.manager)
  @Post(':id/approve')
  async approveLoan(
    @Param('id', ParsePositiveIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      await this.loanService.approve(id, user);
      if (req.flash) req.flash('success', 'Dossier de crédit approuvé.');
    } catch (err: any) {
      if (req.flash) req.flash('error', err.message || 'Erreur lors de l’approbation.');
    }
    const isHtmx = req.headers['hx-request'] === 'true';
    if (isHtmx) {
      res.setHeader('HX-Redirect', `/loans/${id}`);
      return res.status(200).send();
    }
    return res.redirect(`/loans/${id}`);
  }

  @Roles(Role.admin, Role.manager)
  @Post(':id/disburse')
  async disburseLoan(
    @Param('id', ParsePositiveIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      await this.loanService.disburse(id, user);
      if (req.flash) req.flash('success', 'Fonds débloqués et échéancier généré avec succès !');
    } catch (err: any) {
      if (req.flash) req.flash('error', err.message || 'Erreur lors du déblocage.');
    }
    const isHtmx = req.headers['hx-request'] === 'true';
    if (isHtmx) {
      res.setHeader('HX-Redirect', `/loans/${id}`);
      return res.status(200).send();
    }
    return res.redirect(`/loans/${id}`);
  }

  @Post(':id/repay/:scheduleId')
  async repayInstallment(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Param('scheduleId', ParsePositiveIntPipe) scheduleId: number,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      await this.loanService.repayInstallment(id, scheduleId, user);
      if (req.flash) req.flash('success', 'Échéance remboursée avec succès.');
    } catch (err: any) {
      if (req.flash) req.flash('error', err.message || 'Erreur lors du remboursement de l’échéance.');
    }
    const isHtmx = req.headers['hx-request'] === 'true';
    if (isHtmx) {
      res.setHeader('HX-Redirect', `/loans/${id}`);
      return res.status(200).send();
    }
    return res.redirect(`/loans/${id}`);
  }
}
