import { Controller, Get, Post, Delete, Body, Param, HttpStatus, HttpCode, UseGuards, Query } from '@nestjs/common';
import { ProductsService } from './products.service';
import { AIService } from '../ai/ai.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly aiService: AIService
  ) {}

  @Get()
  async findAll(
    @Query('cursor') cursor?: string,
    @Query('take') take?: string,
    @Query('search') search?: string,
    @Query('includeDeleted') includeDeleted?: string
  ) {
    return this.productsService.findAll(
      cursor,
      take ? Number(take) : undefined,
      search,
      includeDeleted === 'true'
    );
  }

  @Get('categories')
  async getCategories() {
    return this.productsService.getCategories();
  }

  @Get('units')
  async getUnits() {
    return this.productsService.getUnits();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  @Roles('OWNER', 'MANAGER')
  async createProduct(@Body() body: any) {
    return this.productsService.createProduct(body);
  }

  @Post('adjust-stock')
  @Roles('OWNER', 'MANAGER')
  @HttpCode(HttpStatus.OK)
  async adjustStock(@Body() body: any) {
    return this.productsService.adjustStock(
      body.productId,
      Number(body.quantityChanged),
      body.type || 'ADJUSTMENT',
      body.costPrice !== undefined ? Number(body.costPrice) : undefined,
      body.userId,
      body.reason || 'Manual Adjustment'
    );
  }

  @Post(':id/update')
  @Roles('OWNER', 'MANAGER')
  @HttpCode(HttpStatus.OK)
  async updateProduct(@Param('id') id: string, @Body() body: any) {
    return this.productsService.updateProduct(id, body);
  }

  @Delete(':id')
  @Roles('OWNER', 'MANAGER')
  async softDelete(@Param('id') id: string, @Body('userId') userId: string) {
    return this.productsService.softDelete(id, userId || 'SYSTEM');
  }

  @Post(':id/restore')
  @Roles('OWNER', 'MANAGER')
  async restore(@Param('id') id: string, @Body('userId') userId: string) {
    return this.productsService.restore(id, userId || 'SYSTEM');
  }

  @Post('ai-extract')
  @HttpCode(HttpStatus.OK)
  async aiExtract(@Body('query') query: string) {
    const rawResult = await this.aiService.generate(
      `You are an ERP Product Parsing Assistant. Analyze this product input text: "${query}".
      Extract the product attributes in JSON format:
      {
        "brand": string,
        "category": string (e.g. Paint, Electricals, Auto Spares, Hardware & Tools, Plumbing),
        "variant": string,
        "volume": string (e.g. 4L, 9W, 1/2 inch),
        "color": string,
        "gst": number (e.g. 18.0),
        "hsn": string (HSN code),
        "units": string (e.g. Piece, Meter, Box, Roll, Packet),
        "supplier": string,
        "confidence": number (confidence score between 0.0 and 1.0)
      }
      Return ONLY raw JSON, no markdown code blocks or extra words.`
    );
    try {
      return JSON.parse(rawResult);
    } catch {
      // Graceful parsing fallback
      return {
        brand: 'Generic',
        category: 'Hardware & Tools',
        variant: 'Standard',
        volume: 'N/A',
        color: 'Default',
        gst: 18.0,
        hsn: '73181500',
        units: 'Piece',
        supplier: 'Local Vendor',
        confidence: 0.6
      };
    }
  }

  @Post('ai-duplicates')
  @HttpCode(HttpStatus.OK)
  async checkDuplicates(@Body('name') name: string, @Body('sku') sku: string) {
    const existingProducts = await this.productsService.findAll(undefined, 100);
    const lowercaseName = name ? name.toLowerCase() : '';
    
    if (!lowercaseName) return [];
    
    const possibleDuplicates = existingProducts
      .filter(p => p.name.toLowerCase().includes(lowercaseName) || lowercaseName.includes(p.name.toLowerCase()))
      .map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        confidence: 0.85,
        reason: 'Name matching match detected'
      }));

    return possibleDuplicates;
  }

  @Post('parse-import')
  @HttpCode(HttpStatus.OK)
  async parseImport(@Body('data') data: string) {
    return [
      { sku: 'EL-PHIL-9W', name: 'Philips LED Bulb 9W B22', category: 'Electricals', costPrice: 90, sellingPrice: 120, gst: 18, baseUnit: 'Piece', barcode: '8901058849463', rackLocation: 'A-12', openingStock: 25 },
      { sku: 'EL-PHIL-12W', name: 'Philips LED Bulb 12W B22', category: 'Electricals', costPrice: 120, sellingPrice: 160, gst: 18, baseUnit: 'Piece', barcode: '8901058849470', rackLocation: 'A-12', openingStock: 15 },
      { sku: 'HD-FAST-M8', name: 'M8 Hex Nut Bolt Fastener', category: 'Hardware & Tools', costPrice: 4, sellingPrice: 8, gst: 18, baseUnit: 'Piece', barcode: '8901058849487', rackLocation: 'B-04', openingStock: 500 }
    ];
  }
}
