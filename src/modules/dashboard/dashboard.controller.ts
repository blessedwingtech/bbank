import { Controller, Get, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { DashboardService } from './dashboard.service';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  async getDashboard(
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const data = await this.dashboardService.getDashboardData(user);
    const isHtmx = req.headers['hx-request'] === 'true';

    return res.render('dashboard/index', {
      ...data,
      isHtmx,
      pageTitle: 'Tableau de bord - B-Bank',
    });
  }
}
