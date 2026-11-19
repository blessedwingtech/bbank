import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParsePositiveIntPipe } from '../../common/pipes/parse-positive-int.pipe';

@Controller('users')
@Roles(Role.admin, Role.manager)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  async listUsers(@Req() req: Request, @Res() res: Response) {
    const users = await this.userService.findAll();
    const isHtmx = req.headers['hx-request'] === 'true';
    return res.render('users/list', {
      users,
      isHtmx,
      pageTitle: 'Gestion des utilisateurs',
    });
  }

  @Get('search')
  async searchUsers(@Query('q') q: string, @Req() req: Request, @Res() res: Response) {
    const users = await this.userService.search(q);
    return res.render('users/partials/user-table-rows', { users });
  }

  @Get(':id/edit')
  async editUser(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const userToEdit = await this.userService.findById(id);
    const isHtmx = req.headers['hx-request'] === 'true';
    return res.render('users/edit', {
      userToEdit,
      isHtmx,
      pageTitle: `Modifier l'utilisateur ${userToEdit.username}`,
    });
  }

  @Post(':id')
  async updateUser(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @CurrentUser('role') currentUserRole: Role,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      await this.userService.update(id, dto, currentUserRole);
      if (req.flash) req.flash('success', 'Utilisateur mis à jour avec succès.');
      const isHtmx = req.headers['hx-request'] === 'true';
      if (isHtmx) {
        res.setHeader('HX-Redirect', '/users');
        return res.status(200).send();
      }
      return res.redirect('/users');
    } catch (err: any) {
      if (req.flash) req.flash('error', err.message || 'Erreur lors de la mise à jour.');
      return res.redirect(`/users/${id}/edit`);
    }
  }

  @Delete(':id')
  async deleteUser(
    @Param('id', ParsePositiveIntPipe) id: number,
    @CurrentUser('id') currentUserId: number,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      await this.userService.softDelete(id, currentUserId);
      if (req.flash) req.flash('success', 'Utilisateur désactivé avec succès.');
      const isHtmx = req.headers['hx-request'] === 'true';
      if (isHtmx) {
        // HTMX can replace row or trigger reload
        return res.send(`
          <tr id="user-${id}" class="table-danger">
            <td colspan="7" class="text-center text-muted fst-italic">
              Utilisateur #${id} désactivé.
            </td>
          </tr>
        `);
      }
      return res.redirect('/users');
    } catch (err: any) {
      if (req.flash) req.flash('error', err.message || 'Erreur lors de la suppression.');
      return res.redirect('/users');
    }
  }
}
