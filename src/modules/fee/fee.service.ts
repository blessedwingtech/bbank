import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFeeDto } from './dto/create-fee.dto';

@Injectable()
export class FeeService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.fee.findMany({
      include: {
        account: {
          select: { id: true, accountNumber: true, owner: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByAccountId(accountId: number) {
    return this.prisma.fee.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(accountId: number, dto: CreateFeeDto) {
    return this.prisma.fee.create({
      data: {
        accountId,
        type: dto.type,
        amount: dto.amount,
        description: dto.description,
      },
    });
  }
}
