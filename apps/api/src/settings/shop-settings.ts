import { Body, Controller, Get, Injectable, Module, Put, Req, UseGuards } from '@nestjs/common';
import { IsEmail, IsOptional, IsString, Length, Matches, ValidateIf } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PrismaService } from '../prisma.service';

// Shop profile printed on invoices and receipts, stored as SystemSetting rows with a "shop_" prefix.
export const SHOP_FIELDS = ['name', 'address', 'phone', 'email', 'gstin', 'state', 'upiId', 'invoiceFooter', 'invoiceTerms'] as const;
export type ShopProfile = Record<(typeof SHOP_FIELDS)[number], string>;

const DEFAULTS: ShopProfile = {
  name: 'ShopOS Store',
  address: '',
  phone: '',
  email: '',
  gstin: '',
  state: '',
  upiId: '',
  invoiceFooter: 'Thank you for shopping with us!',
  invoiceTerms: 'Goods once sold can be returned within 7 days with the bill, as per store policy.',
};

const keyFor = (field: string) => `shop_${field}`;

export class ShopProfileDto {
  @IsOptional() @IsString() @Length(2, 80) name?: string;
  @IsOptional() @IsString() @Length(0, 250) address?: string;
  @IsOptional() @IsString() @Length(0, 20) phone?: string;
  @IsOptional() @ValidateIf(o => !!o.email) @IsEmail() email?: string;
  @IsOptional() @ValidateIf(o => !!o.gstin) @Matches(/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/, { message: 'gstin is not a valid GSTIN' }) gstin?: string;
  @IsOptional() @IsString() @Length(0, 40) state?: string;
  @IsOptional() @ValidateIf(o => !!o.upiId) @Matches(/^[\w.-]{2,}@[a-zA-Z]{2,}$/, { message: 'upiId must look like name@bank' }) upiId?: string;
  @IsOptional() @IsString() @Length(0, 200) invoiceFooter?: string;
  @IsOptional() @IsString() @Length(0, 500) invoiceTerms?: string;
}

@Injectable()
export class ShopSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<ShopProfile> {
    const rows = await this.prisma.client.systemSetting.findMany({ where: { key: { in: SHOP_FIELDS.map(keyFor) } } });
    const profile = { ...DEFAULTS };
    for (const field of SHOP_FIELDS) {
      const row = rows.find(r => r.key === keyFor(field));
      if (row) profile[field] = row.value;
    }
    return profile;
  }

  async update(input: Partial<ShopProfile>, userId: string) {
    for (const field of SHOP_FIELDS) {
      const value = input[field];
      if (value === undefined) continue;
      await this.prisma.client.systemSetting.upsert({ where: { key: keyFor(field) }, update: { value: value.trim() }, create: { key: keyFor(field), value: value.trim() } });
    }
    await this.prisma.client.auditLog.create({ data: { userId, action: 'UPDATE_SHOP_PROFILE', details: JSON.stringify(Object.keys(input)) } });
    return this.get();
  }
}

@Controller('settings/shop')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShopSettingsController {
  constructor(private readonly settings: ShopSettingsService) {}

  @Get()
  get() {
    return this.settings.get();
  }

  @Put()
  @Roles('OWNER')
  update(@Req() req: any, @Body() body: ShopProfileDto) {
    return this.settings.update(body as Partial<ShopProfile>, req.user.userId);
  }
}

@Module({
  controllers: [ShopSettingsController],
  providers: [ShopSettingsService],
  exports: [ShopSettingsService],
})
export class ShopSettingsModule {}
