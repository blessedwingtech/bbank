import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Get('login')
  getLogin(@Req() req: Request, @Res() res: Response) {
    if (req.session?.user) {
      return res.redirect('/dashboard');
    }
    const isHtmx = req.headers['hx-request'] === 'true';
    return res.render('auth/login', {
      pageTitle: 'Connexion - B-Bank',
      isHtmx,
    });
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  async postLogin(@Body() dto: LoginDto, @Req() req: Request, @Res() res: Response) {
    try {
      const user = await this.authService.login(dto);
      req.session.user = user;

      // Save session explicitly before redirect
      req.session.save((err) => {
        if (err) {
          if (req.flash) req.flash('error', 'Erreur de session.');
          return res.redirect('/auth/login');
        }
        const isHtmx = req.headers['hx-request'] === 'true';
        if (isHtmx) {
          res.setHeader('HX-Redirect', '/dashboard');
          return res.status(200).send();
        }
        return res.redirect('/dashboard');
      });
    } catch (err: any) {
      if (req.flash) {
        req.flash('error', err.message || 'Identifiants incorrects.');
      }
      const isHtmx = req.headers['hx-request'] === 'true';
      if (isHtmx) {
        res.setHeader('HX-Redirect', '/auth/login');
        return res.status(401).send();
      }
      return res.redirect('/auth/login');
    }
  }

  @Public()
  @Get('register')
  getRegister(@Req() req: Request, @Res() res: Response) {
    if (req.session?.user) {
      return res.redirect('/dashboard');
    }
    const isHtmx = req.headers['hx-request'] === 'true';
    return res.render('auth/register', {
      pageTitle: 'Inscription - B-Bank',
      isHtmx,
    });
  }

  @Public()
  @Post('register')
  async postRegister(@Body() dto: RegisterDto, @Req() req: Request, @Res() res: Response) {
    try {
      await this.authService.register(dto);
      if (req.flash) {
        req.flash('success', 'Votre compte a été créé avec succès. Vous pouvez maintenant vous connecter.');
      }
      const isHtmx = req.headers['hx-request'] === 'true';
      if (isHtmx) {
        res.setHeader('HX-Redirect', '/auth/login');
        return res.status(200).send();
      }
      return res.redirect('/auth/login');
    } catch (err: any) {
      if (req.flash) {
        req.flash('error', err.message || "Erreur lors de l'inscription.");
      }
      const isHtmx = req.headers['hx-request'] === 'true';
      if (isHtmx) {
        res.setHeader('HX-Redirect', '/auth/register');
        return res.status(400).send();
      }
      return res.redirect('/auth/register');
    }
  }

  @Post('logout')
  postLogout(@Req() req: Request, @Res() res: Response) {
    req.session.destroy((err) => {
      res.clearCookie('bbank.sid');
      const isHtmx = req.headers['hx-request'] === 'true';
      if (isHtmx) {
        res.setHeader('HX-Redirect', '/auth/login');
        return res.status(200).send();
      }
      return res.redirect('/auth/login');
    });
  }
}
