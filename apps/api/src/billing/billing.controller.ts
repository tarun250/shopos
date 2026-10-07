import { Controller, Get, Post, Body, Param, Delete, HttpStatus, HttpCode, UseGuards, Req, ForbiddenException, Query } from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { IsNotEmpty, IsString, IsNumber, IsOptional, IsPositive, Min, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCustomerDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  creditLimit?: number;

  @IsString()
  @IsOptional()
  priceLevel?: string;
}

export class CreateBillItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @Min(0.001)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsNumber()
  @Min(0)
  discount: number;
}

export class CreatePaymentSplitDto {
  @IsString()
  @IsNotEmpty()
  paymentMethod: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsString()
  @IsOptional()
  transactionRef?: string;
}

export class CreateBillDataDto {
  @IsString()
  @IsOptional()
  customerId?: string;

  @ValidateNested({ each: true })
  @Type(() => CreateBillItemDto)
  items: CreateBillItemDto[];

  @IsNumber()
  @Min(0)
  discountAmount: number;

  @IsString()
  @IsNotEmpty()
  paymentMethod: string;

  @IsNumber()
  @Min(0)
  paidAmount: number;

  @IsBoolean()
  isQuote: boolean;

  @ValidateNested({ each: true })
  @Type(() => CreatePaymentSplitDto)
  @IsOptional()
  paymentSplits?: CreatePaymentSplitDto[];

  @IsString()
  @IsOptional()
  approvedByManagerId?: string;
}

export class CreateBillDto {
  @ValidateNested()
  @Type(() => CreateBillDataDto)
  billData: CreateBillDataDto;

  @IsString()
  @IsNotEmpty()
  userId: string;
}

export class ApprovalActionDto {
  @IsString()
  @IsNotEmpty()
  status: 'APPROVED' | 'REJECTED';

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsNotEmpty()
  approverId: string;
}

export class ReturnItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @IsPositive()
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsString()
  @IsOptional()
  disposition?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class SalesReturnDto {
  @IsString()
  @IsNotEmpty()
  billId: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsNotEmpty()
  userId: string;

  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  items: ReturnItemDto[];
}

export class RecordPaymentDto {
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsString()
  @IsNotEmpty()
  paymentMethod: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsNotEmpty()
  userId: string;
}

@Controller('billing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('customers')
  async getCustomers() {
    return this.billingService.getCustomers();
  }

  @Get('suppliers')
  async getSuppliers() {
    return this.billingService.getSuppliers();
  }

  @Post('customers')
  @HttpCode(HttpStatus.CREATED)
  async createCustomer(@Body() body: CreateCustomerDto, @Req() req: any) {
    if (body.creditLimit !== undefined && req.user?.role !== 'OWNER') {
      throw new ForbiddenException('Only the OWNER can set or modify credit limits for a customer.');
    }
    return this.billingService.createCustomer(body);
  }

  @Post('bills')
  @HttpCode(HttpStatus.CREATED)
  async createBill(@Body() body: CreateBillDto) {
    return this.billingService.createBill(body.billData, body.userId);
  }

  @Get('bills')
  async listBills(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('take') take?: string,
  ) {
    return this.billingService.listBills({
      search,
      status,
      paymentMethod,
      from,
      to,
      page: page ? Number(page) : undefined,
      take: take ? Number(take) : undefined,
    });
  }

  @Get('bills/:id')
  async getBillDetail(@Param('id') id: string) {
    return this.billingService.getBillDetail(id);
  }

  @Get('approvals')
  @Roles('OWNER', 'MANAGER')
  async getApprovals() {
    return this.billingService.getApprovals();
  }

  @Get('bills/:id/status')
  async getBillStatus(@Param('id') id: string) {
    return this.billingService.getBillStatus(id);
  }

  @Delete('bills/:id')
  @Roles('OWNER', 'MANAGER')
  async deleteBill(@Param('id') id: string) {
    return this.billingService.deleteBill(id);
  }

  @Post('approvals/:id/action')
  @Roles('OWNER', 'MANAGER')
  @HttpCode(HttpStatus.OK)
  async handleApprovalAction(@Param('id') id: string, @Body() body: ApprovalActionDto) {
    return this.billingService.handleApprovalAction(id, {
      action: body.status === 'APPROVED' ? 'APPROVE' : 'REJECT',
      userId: body.approverId,
      reason: body.reason
    });
  }

  // Returns Engine
  @Post('returns/sales')
  @Roles('OWNER', 'MANAGER')
  @HttpCode(HttpStatus.CREATED)
  async createSalesReturn(@Body() body: SalesReturnDto) {
    return this.billingService.createSalesReturn(body);
  }

  @Post('returns/purchases')
  @Roles('OWNER', 'MANAGER')
  @HttpCode(HttpStatus.CREATED)
  async createPurchaseReturn(@Body() body: any) {
    return this.billingService.createPurchaseReturn(body);
  }

  @Get('returns')
  @Roles('OWNER', 'MANAGER')
  async getReturns() {
    return this.billingService.getReturns();
  }

  // Customer Ledger timeline
  @Get('customers/:id/ledger')
  @Roles('OWNER', 'MANAGER')
  async getCustomerLedger(@Param('id') id: string) {
    return this.billingService.getCustomerLedger(id);
  }

  @Post('customers/:id/payments')
  @Roles('OWNER', 'MANAGER')
  @HttpCode(HttpStatus.CREATED)
  async recordCustomerPayment(@Param('id') id: string, @Body() body: RecordPaymentDto) {
    return this.billingService.recordCustomerPayment(id, body);
  }

  // Supplier Ledger timeline
  @Get('suppliers/:id/ledger')
  @Roles('OWNER', 'MANAGER')
  async getSupplierLedger(@Param('id') id: string) {
    return this.billingService.getSupplierLedger(id);
  }

  @Post('suppliers/:id/payments')
  @Roles('OWNER', 'MANAGER')
  @HttpCode(HttpStatus.CREATED)
  async recordSupplierPayment(@Param('id') id: string, @Body() body: RecordPaymentDto) {
    return this.billingService.recordSupplierPayment(id, body);
  }
}
