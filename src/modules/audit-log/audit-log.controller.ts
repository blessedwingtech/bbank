import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuditLogService } from './audit-log.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('audit-logs')
@Roles(Role.admin)
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  async listLogs(
    @Query('username') username: string,
    @Query('action') action: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const logs = await this.auditLogService.findAll({
      username,
      action,
      startDate,
      endDate,
    });

    const isHtmx = req.headers['hx-request'] === 'true';
    return res.render('audit-logs/list', {
      logs,
      filters: { username, action, startDate, endDate },
      isHtmx,
      pageTitle: "Journaux d'audit (Sécurité)",
    });
  }
}
