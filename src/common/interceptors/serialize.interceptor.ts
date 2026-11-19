import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class SerializeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        return this.stripSensitiveData(data);
      }),
    );
  }

  private stripSensitiveData(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
      return obj.map((item) => this.stripSensitiveData(item));
    }
    const clean: any = {};
    for (const key of Object.keys(obj)) {
      if (/password|hash|salt|secret/i.test(key)) {
        continue;
      }
      clean[key] = this.stripSensitiveData(obj[key]);
    }
    return clean;
  }
}
