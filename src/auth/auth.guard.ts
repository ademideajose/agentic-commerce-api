// src/auth/auth.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  private readonly validApiKeys: string[];

  constructor(private readonly configService: ConfigService) {
    const keys = this.configService.get<string>('VALID_API_KEYS');
    this.validApiKeys = keys ? keys.split(',').map((key) => key.trim()) : [];
    if (this.validApiKeys.length === 0) {
      console.warn(
        'Warning: No VALID_API_KEYS configured. API key authentication will deny all requests to protected routes.',
      );
    }
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key']; // Or your preferred header name, e.g., 'authorization' for Bearer tokens

    if (!apiKey) {
      throw new UnauthorizedException('API key is missing.');
    }

    if (!this.validApiKeys.includes(apiKey)) {
      throw new UnauthorizedException('Invalid API key.');
    }

    return true;
  }
}
