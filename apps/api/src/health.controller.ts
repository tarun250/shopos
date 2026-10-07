import { Controller, Get, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async checkHealth() {
    try {
      // Test database connectivity
      await this.prisma.client.user.count();
      return {
        status: 'ok',
        database: 'healthy',
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      throw new InternalServerErrorException({
        status: 'unhealthy',
        database: 'unavailable',
        error: err.message,
      });
    }
  }
}
