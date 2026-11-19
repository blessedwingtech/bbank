import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { StatementService } from './statement.service';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { ParsePositiveIntPipe } from '../../common/pipes/parse-positive-int.pipe';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('statements')
export class StatementController {
  constructor(
    private readonly statementService: StatementService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async getSelectAccount(
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const isStaff = user.role === 'admin' || user.role === 'manager';
    const accounts = await this.prisma.account.findMany({
      where: isStaff ? {} : { userId: user.id },
      orderBy: { accountNumber: 'asc' },
    });

    const isHtmx = req.headers['hx-request'] === 'true';
    return res.render('statements/index', {
      accounts,
      isHtmx,
      pageTitle: 'Relevés bancaires',
    });
  }

  @Get(':accountId')
  async getViewStatement(
    @Param('accountId', ParsePositiveIntPipe) accountId: number,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const data = await this.statementService.getStatementData(
      accountId,
      { startDate, endDate },
      user,
    );

    const isHtmx = req.headers['hx-request'] === 'true';
    return res.render('statements/view', {
      ...data,
      isHtmx,
      pageTitle: `Relevé de compte - ${data.account.accountNumber}`,
    });
  }

  @Get(':accountId/download')
  async downloadStatementPdf(
    @Param('accountId', ParsePositiveIntPipe) accountId: number,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @CurrentUser() user: CurrentUserPayload,
    @Res() res: Response,
  ) {
    const data = await this.statementService.getStatementData(
      accountId,
      { startDate, endDate },
      user,
    );

    const pdfDoc = this.statementService.generatePdf(data);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=releve-${data.account.accountNumber}-${new Date().toISOString().split('T')[0]}.pdf`,
    );

    pdfDoc.pipe(res);
  }
}
