import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import type { Request } from 'express';
import type { User } from '@supabase/supabase-js';

type SupabaseClientType = ReturnType<typeof createClient>;

type RequestWithUser = Request & {
  user?: User;
};

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private readonly supabase: SupabaseClientType;

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>(
      'NEST_PUBLIC_SUPABASE_URL',
    );
    const supabaseAnonKey = this.configService.get<string>(
      'NEST_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    );

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase env belum lengkap');
    }

    this.supabase = createClient(supabaseUrl, supabaseAnonKey);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Authorization header tidak ada');
    }

    const [type, token] = authHeader.split(' ');

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Format token tidak valid');
    }

    const userResponse = await this.supabase.auth.getUser(token);

    if (userResponse.error || !userResponse.data.user) {
      throw new UnauthorizedException('Token tidak valid');
    }

    request.user = userResponse.data.user;

    return true;
  }
}
