import { Body, Controller, Get, NotFoundException, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Length, Matches, Min, ValidateNested } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PrismaService } from '../prisma.service';
import { PurchasesService } from './purchases.service';

class PurchaseLineDto {
  @IsString() @IsNotEmpty() productId: string;
  @IsNumber() @IsPositive() quantity: number;
  @IsNumber() @Min(0) unitCost: number;
}

export class CreatePurchaseDto {
  @IsString() @IsNotEmpty() supplierId: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => PurchaseLineDto) items: PurchaseLineDto[];
  @IsOptional() @IsString() expectedDate?: string;
  @IsOptional() @IsString() @Length(0, 500) notes?: string;
  @IsOptional() @IsString() @Length(0, 60) supplierInvoiceNumber?: string;
}

class ReceiveLineDto {
  @IsString() @IsNotEmpty() productId: string;
  @IsNumber() @IsPositive() quantity: number;
}

export class ReceivePurchaseDto {
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ReceiveLineDto) items?: ReceiveLineDto[];
  @IsOptional() @IsBoolean() updateCostPrice?: boolean;
  @IsOptional() @IsString() @Length(0, 60) supplierInvoiceNumber?: string;
  @IsOptional() @IsNumber() @Min(0) amountPaid?: number;
  @IsOptional() @IsIn(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE']) paymentMethod?: string;
}

export class SupplierDto {
  @IsString() @Length(2, 100) name: string;
  @IsOptional() @IsString() @Length(0, 120) companyName?: string;
  @IsString() @Matches(/^\d{10}$/, { message: 'phone must be 10 digits' }) phone: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @Matches(/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/, { message: 'gstin is not a valid GSTIN' }) gstin?: string;
  @IsOptional() @IsString() @Length(0, 250) address?: string;
  @IsOptional() @IsNumber() @Min(0) creditLimit?: number;
}

@Controller('purchases')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'MANAGER')
export class PurchasesController {
  constructor(private readonly purchases: PurchasesService) {}

  @Get()
  list(
    @Query('status') status?: string,
    @Query('supplierId') supplierId?: string,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('take') take?: string,
  ) {
    return this.purchases.list({ status, supplierId, search, from, to, page: page ? Number(page) : undefined, take: take ? Number(take) : undefined });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.purchases.get(id);
  }

  @Post()
  create(@Req() req: any, @Body() body: CreatePurchaseDto) {
    return this.purchases.create(body, req.user.userId);
  }

  @Post(':id/receive')
  receive(@Req() req: any, @Param('id') id: string, @Body() body: ReceivePurchaseDto) {
    return this.purchases.receive(id, body, req.user.userId);
  }

  @Post(':id/cancel')
  cancel(@Req() req: any, @Param('id') id: string) {
    return this.purchases.cancel(id, req.user.userId);
  }
}

@Controller('suppliers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SuppliersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.client.supplier.findMany({ where: { isDeleted: false }, orderBy: { name: 'asc' } });
  }

  @Post()
  @Roles('OWNER', 'MANAGER')
  async create(@Req() req: any, @Body() body: SupplierDto) {
    const supplier = await this.prisma.client.supplier.create({ data: { ...body, creditLimit: body.creditLimit ?? 0 } });
    await this.prisma.client.auditLog.create({ data: { userId: req.user.userId, action: 'CREATE_SUPPLIER', details: JSON.stringify({ supplierId: supplier.id, name: supplier.name }) } });
    return supplier;
  }

  @Put(':id')
  @Roles('OWNER', 'MANAGER')
  async update(@Req() req: any, @Param('id') id: string, @Body() body: SupplierDto) {
    const existing = await this.prisma.client.supplier.findFirst({ where: { id, isDeleted: false } });
    if (!existing) throw new NotFoundException('Supplier not found');
    const supplier = await this.prisma.client.supplier.update({ where: { id }, data: body });
    await this.prisma.client.auditLog.create({ data: { userId: req.user.userId, action: 'UPDATE_SUPPLIER', details: JSON.stringify({ supplierId: id }) } });
    return supplier;
  }
}
