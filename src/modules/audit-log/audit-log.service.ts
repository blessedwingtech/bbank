import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params?: {
    username?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const where: any = {};

    if (params?.username) {
      where.username = { contains: params.username };
    }
    if (params?.action) {
      where.action = { contains: params.action };
    }
    if (params?.startDate || params?.endDate) {
      where.timestamp = {};
      if (params.startDate) where.timestamp.gte = new Date(params.startDate);
      if (params.endDate) {
        const end = new Date(params.endDate);
        end.setHours(23, 59, 59, 999);
        where.timestamp.lte = end;
      }
    }

    return this.prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 500,
    });
  }
}
