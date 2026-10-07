import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { CostPriceInterceptor } from './auth/cost-price.interceptor';
import helmet from 'helmet';
import * as compression from 'compression';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Apply Gzip payload compression
  // Server-sent events (AI agent streaming) must not be buffered by compression
  app.use(compression({
    filter: (req, res) => !String(res.getHeader('Content-Type') || '').includes('text/event-stream') && compression.filter(req, res),
  }));
  
  // Apply Helmet headers for security (CSP, HSTS, XSS-Filter)
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));

  // Enable CORS with restricted origins (production ready)
  app.enableCors({
    origin: ['http://localhost:3000'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Enable Global validation pipe with strict whitelisting to reject illegal payloads
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Enable Cost Price Masking Interceptor globally to prevent non-owner cost visibility
  app.useGlobalInterceptors(new CostPriceInterceptor());

  await app.listen(3001);
  console.log(`Backend API successfully running on: http://localhost:3001`);
}
bootstrap();
