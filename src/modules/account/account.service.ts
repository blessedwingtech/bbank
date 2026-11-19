import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { AccountStatus, Role } from '@prisma/client';
import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';

@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: CurrentUserPayload) {
    const isStaff = user.role === Role.admin || user.role === Role.manager;
    return this.prisma.account.findMany({
      where: isStaff ? {} : { userId: user.id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: { transactions: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: number, user: CurrentUserPayload) {
    const account = await this.prisma.account.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        transactions: {
          take: 20,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!account) {
      throw new NotFoundException(`Compte #${id} introuvable.`);
    }

    // Anti-IDOR check: user must own the account or be admin/manager
    const isStaff = user.role === Role.admin || user.role === Role.manager;
    if (!isStaff && account.userId !== user.id) {
      throw new ForbiddenException("Accès interdit : ce compte ne vous appartient pas.");
    }

    return account;
  }

  async create(dto: CreateAccountDto, currentUser: CurrentUserPayload) {
    const isStaff = currentUser.role === Role.admin || currentUser.role === Role.manager;
    let targetUserId = currentUser.id;

    if (isStaff && dto.userId) {
      const targetUser = await this.prisma.user.findUnique({ where: { id: dto.userId } });
      if (!targetUser) {
        throw new NotFoundException(`Utilisateur cible #${dto.userId} introuvable.`);
      }
      targetUserId = dto.userId;
    }

    const targetUser = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    // Generate unique account number: BB- + 8 random digits
    let accountNumber = '';
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      const randomDigits = Math.floor(10000000 + Math.random() * 90000000);
      accountNumber = `BB-${randomDigits}`;
      const existing = await this.prisma.account.findUnique({
        where: { accountNumber },
      });
      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      throw new BadRequestException("Impossible de générer un numéro de compte unique. Veuillez réessayer.");
    }

    const ownerName = `${targetUser.firstName || targetUser.username} ${targetUser.lastName || ''}`.trim();

    return this.prisma.account.create({
      data: {
        accountNumber,
        owner: ownerName,
        accountType: dto.accountType,
        balance: 0.0,
        accumulatedInterest: 0.0,
        status: AccountStatus.active,
        userId: targetUserId,
      },
    });
  }

  async freeze(id: number) {
    const account = await this.prisma.account.findUnique({ where: { id } });
    if (!account) {
      throw new NotFoundException(`Compte #${id} introuvable.`);
    }
    return this.prisma.account.update({
      where: { id },
      data: { status: AccountStatus.frozen },
    });
  }

  async unfreeze(id: number) {
    const account = await this.prisma.account.findUnique({ where: { id } });
    if (!account) {
      throw new NotFoundException(`Compte #${id} introuvable.`);
    }
    return this.prisma.account.update({
      where: { id },
      data: { status: AccountStatus.active },
    });
  }
}
