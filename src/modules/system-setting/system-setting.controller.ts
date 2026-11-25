import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { SystemSettingService } from './system-setting.service';
import { UpdateSystemSettingDto } from './dto/update-system-setting.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('settings')
@Roles(Role.admin)
export class SystemSettingController {
  constructor(private readonly settingService: SystemSettingService) {}

  @Get()
  async getSettingsPage(@Req() req: Request, @Res() res: Response) {
    const settings = await this.settingService.getSettings();
    const isHtmx = req.headers['hx-request'] === 'true';

    return res.render('settings/index', {
      settings,
      isHtmx,
      pageTitle: 'Paramètres du Progiciel & Modules',
    });
  }

  @Post()
  async updateSettings(
    @Body() dto: UpdateSystemSettingDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      await this.settingService.updateSettings(dto);
      if (req.flash) req.flash('success', 'Paramètres institutionnels et modules mis à jour avec succès.');
      const isHtmx = req.headers['hx-request'] === 'true';
      if (isHtmx) {
        res.setHeader('HX-Redirect', '/settings');
        return res.status(200).send();
      }
      return res.redirect('/settings');
    } catch (err: any) {
      if (req.flash) req.flash('error', err.message || 'Erreur lors de la mise à jour des paramètres.');
      return res.redirect('/settings');
    }
  }
}
