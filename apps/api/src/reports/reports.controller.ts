import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'MANAGER')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('summary')
  summary(@Req() req: any, @Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.summary(from, to, req.user.role);
  }

  @Get('gst')
  gst(@Query('month') month?: string) {
    return this.reports.gst(month);
  }

  @Get('reorder')
  reorder(@Query('leadDays') leadDays?: string, @Query('coverDays') coverDays?: string) {
    const clamp = (v: string | undefined, d: number) => Math.min(Math.max(Number(v) || d, 1), 90);
    return this.reports.reorder(clamp(leadDays, 7), clamp(coverDays, 14));
  }
}
