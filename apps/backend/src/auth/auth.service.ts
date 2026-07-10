import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { KnexService } from '../database/knex.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

type SupabaseClientType = ReturnType<typeof createClient>;

type UserProfileRow = {
  id: string;
  email: string;
  username: string | null;
  full_name: string;
  created_at: Date;
  modify_dt: Date | null;
};

type UserProfilePublic = {
  id: string;
  email: string;
  username: string | null;
  full_name: string;
  created_at: Date;
  modify_dt: Date | null;
};

@Injectable()
export class AuthService {
  private readonly supabase: SupabaseClientType;

  constructor(
    private readonly configService: ConfigService,
    private readonly knexService: KnexService,
  ) {
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

  async register(registerDto: RegisterDto) {
    if (registerDto.username) {
      const existingUsername = await this.knexService
        .connection<UserProfileRow>('users')
        .where({ username: registerDto.username })
        .first();

      if (existingUsername) {
        throw new ConflictException('Username sudah digunakan');
      }
    }

    const signUpResponse = await this.supabase.auth.signUp({
      email: registerDto.email,
      password: registerDto.password,
      options: {
        data: {
          full_name: registerDto.fullName,
          username: registerDto.username ?? null,
        },
      },
    });

    if (signUpResponse.error) {
      throw new BadRequestException(signUpResponse.error.message);
    }

    const authUser = signUpResponse.data.user;

    if (!authUser) {
      throw new BadRequestException('Register gagal');
    }

    const existingProfile = await this.knexService
      .connection<UserProfileRow>('users')
      .where({ id: authUser.id })
      .first();

    if (!existingProfile) {
      await this.knexService.connection<UserProfileRow>('users').insert({
        id: authUser.id,
        email: authUser.email ?? registerDto.email,
        username: registerDto.username ?? null,
        full_name: registerDto.fullName,
      });
    }

    return {
      message: 'Register berhasil',
      user: {
        id: authUser.id,
        email: authUser.email ?? registerDto.email,
        username: registerDto.username ?? null,
        fullName: registerDto.fullName,
      },
      session: signUpResponse.data.session,
    };
  }

  async login(loginDto: LoginDto) {
    const loginResponse = await this.supabase.auth.signInWithPassword({
      email: loginDto.email,
      password: loginDto.password,
    });

    if (loginResponse.error) {
      throw new UnauthorizedException(loginResponse.error.message);
    }

    const authUser = loginResponse.data.user;
    const session = loginResponse.data.session;

    if (!authUser || !session) {
      throw new UnauthorizedException('Login gagal');
    }

    const profile = await this.knexService
      .connection<UserProfileRow, UserProfilePublic>('users')
      .where({ id: authUser.id })
      .select('id', 'email', 'username', 'full_name', 'created_at', 'modify_dt')
      .first();

    return {
      message: 'Login berhasil',
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      user: {
        id: authUser.id,
        email: authUser.email,
        profile: profile ?? null,
      },
    };
  }
}
