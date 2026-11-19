import { Controller, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { InterestService } from './interest.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';

@Controller('interest')
@Roles(Role.admin)
export class InterestController {
  constructor(private readonly interestService: InterestService) {}

  @Post('update-monthly')
  async triggerMonthlyInterest(
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const result = await this.interestService.calculateMonthlyInterests(user.username);
      if (req.flash) {
        req.flash(
          'success',
          `Intérêts appliqués avec succès : ${result.processedCount} comptes d'épargne mis à jour pour un total de ${result.totalInterestDistributed.toFixed(2)} € distribués.`,
        );
      }
    } catch (err: any) {
      if (req.flash) {
        req.flash('error', err.message || "Erreur lors du calcul des intérêts.");
      }
    }

    const isHtmx = req.headers['hx-request'] === 'true';
    if (isHtmx) {
      res.setHeader('HX-Redirect', '/dashboard');
      return res.status(200).send();
    }
    return res.redirect('/dashboard');
  }
}
