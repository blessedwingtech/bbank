import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterDto) {
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });
    if (existingEmail) {
      throw new BadRequestException('Cette adresse email est déjà utilisée.');
    }

    const existingUsername = await this.prisma.user.findUnique({
      where: { username: dto.username.trim() },
    });
    if (existingUsername) {
      throw new BadRequestException("Ce nom d'utilisateur est déjà pris.");
    }

    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
    const hashedPassword = await bcrypt.hash(dto.password, saltRounds);

    const user = await this.prisma.user.create({
      data: {
        username: dto.username.trim(),
        email: dto.email.toLowerCase().trim(),
        password: hashedPassword,
        firstName: dto.firstName?.trim() || null,
        lastName: dto.lastName?.trim() || null,
        phone: dto.phone?.trim() || null,
        address: dto.address?.trim() || null,
        role: Role.user,
        isActive: true,
      },
    });

    // Automatically create a default checking account for new user with zero balance
    const randomDigits = Math.floor(10000000 + Math.random() * 90000000);
    await this.prisma.account.create({
      data: {
        accountNumber: `BB-${randomDigits}`,
        owner: `${user.firstName || user.username} ${user.lastName || ''}`.trim(),
        accountType: 'checking',
        balance: 0.0,
        status: 'active',
        userId: user.id,
      },
    });

    return {
      id: user.id,
      username: user.username,
      email: user.email,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (!user) {
      throw new UnauthorizedException('Identifiants incorrects.');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Votre compte a été désactivé. Veuillez contacter le support.');
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatch) {
      throw new UnauthorizedException('Identifiants incorrects.');
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  }
}
