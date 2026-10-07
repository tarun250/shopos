import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class CostPriceInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const role = user?.role;

    return next.handle().pipe(
      map(data => {
        // Only OWNER has permission to read costPrice and profit calculations
        if (role === 'OWNER') {
          return data;
        }
        return this.sanitize(data);
      })
    );
  }

  private sanitize(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }

    if (data instanceof Date) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitize(item));
    }

    if (typeof data === 'object') {
      const sanitizedObj: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (
          key === 'costPrice' ||
          key === 'profit' ||
          key === 'profitMargin' ||
          key === 'purchasePrice'
        ) {
          // Exclude sensitive cost data
          continue;
        }
        sanitizedObj[key] = this.sanitize(value);
      }
      return sanitizedObj;
    }

    return data;
  }
}
