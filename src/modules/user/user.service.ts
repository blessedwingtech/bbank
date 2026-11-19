import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role } from '@prisma/client';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        address: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { accounts: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        address: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        accounts: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`Utilisateur #${id} introuvable.`);
    }

    return user;
  }

  async update(id: number, dto: UpdateUserDto, modifierRole: Role) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Utilisateur #${id} introuvable.`);
    }

    // Role modification rule: Only admin can change roles.
    const dataToUpdate: any = {};

    if (dto.username && dto.username !== user.username) {
      const checkUsername = await this.prisma.user.findUnique({
        where: { username: dto.username },
      });
      if (checkUsername && checkUsername.id !== id) {
        throw new BadRequestException("Ce nom d'utilisateur est déjà pris.");
      }
      dataToUpdate.username = dto.username;
    }

    if (dto.email && dto.email !== user.email) {
      const checkEmail = await this.prisma.user.findUnique({
        where: { email: dto.email.toLowerCase() },
      });
      if (checkEmail && checkEmail.id !== id) {
        throw new BadRequestException('Cette adresse email est déjà prise.');
      }
      dataToUpdate.email = dto.email.toLowerCase();
    }

    if (dto.firstName !== undefined) dataToUpdate.firstName = dto.firstName;
    if (dto.lastName !== undefined) dataToUpdate.lastName = dto.lastName;
    if (dto.phone !== undefined) dataToUpdate.phone = dto.phone;
    if (dto.address !== undefined) dataToUpdate.address = dto.address;

    if (dto.role) {
      if (modifierRole === Role.admin) {
        dataToUpdate.role = dto.role;
      }
      // If manager tries to change role, ignore or reject
    }

    return this.prisma.user.update({
      where: { id },
      data: dataToUpdate,
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        address: true,
        role: true,
        isActive: true,
      },
    });
  }

  async softDelete(id: number, currentUserId: number) {
    if (id === currentUserId) {
      throw new BadRequestException('Un administrateur ne peut pas supprimer son propre compte.');
    }

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Utilisateur #${id} introuvable.`);
    }

    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async search(term: string) {
    if (!term || term.trim() === '') {
      return this.findAll();
    }

    return this.prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: term } },
          { email: { contains: term } },
          { firstName: { contains: term } },
          { lastName: { contains: term } },
        ],
      },
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        address: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { accounts: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
