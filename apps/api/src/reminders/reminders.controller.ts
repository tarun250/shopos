import { Controller, Post, Get, Body, Param, BadRequestException } from '@nestjs/common';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../prisma.service';

@Controller('reminders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RemindersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getAllReminders() {
    return this.prisma.client.reminder.findMany({
      orderBy: { dueDate: 'asc' }
    });
  }

  @Post()
  async createReminder(@Body() body: {
    title: string;
    type: string;
    dueDate: string;
    priority?: string;
    isRecurring?: boolean;
  }) {
    if (!body.title || !body.type || !body.dueDate) {
      throw new BadRequestException('Title, type, and dueDate are required.');
    }

    return this.prisma.client.reminder.create({
      data: {
        title: body.title,
        type: body.type.toUpperCase(),
        dueDate: new Date(body.dueDate),
        priority: body.priority || 'MEDIUM',
        isRecurring: body.isRecurring || false,
        status: 'PENDING'
      }
    });
  }

  @Post(':id/dismiss')
  async dismissReminder(@Param('id') id: string) {
    return this.prisma.client.reminder.update({
      where: { id },
      data: { status: 'DISMISSED' }
    });
  }
}
