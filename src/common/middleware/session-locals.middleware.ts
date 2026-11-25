import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { SystemSettingService } from '../../modules/system-setting/system-setting.service';

@Injectable()
export class SessionLocalsMiddleware implements NestMiddleware {
  constructor(private readonly settingService: SystemSettingService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const user = req.session?.user || null;
    res.locals.user = user;
    res.locals.connected = !!user;
    res.locals.currentUrl = req.originalUrl || req.url;
    res.locals.isHtmx = req.headers['hx-request'] === 'true';

    // System Settings (Feature Flags)
    const settings = await this.settingService.getSettings();
    res.locals.systemSettings = settings;

    // CSRF Token support
    if (typeof req.csrfToken === 'function') {
      res.locals.csrfToken = req.csrfToken();
    } else {
      res.locals.csrfToken = '';
    }

    // Flash messages support
    if (typeof req.flash === 'function') {
      res.locals.messages = {
        success: req.flash('success') || [],
        error: req.flash('error') || [],
        warning: req.flash('warning') || [],
        info: req.flash('info') || [],
      };
    } else {
      res.locals.messages = { success: [], error: [], warning: [], info: [] };
    }

    next();
  }
}
