import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { KnexService } from '../database/knex.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SupabaseService } from 'src/supabase/supabase.service';
import { SupabaseMode } from 'src/supabase/supabase.config';

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
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly knexService: KnexService,
  ) {}

  async register(registerDto: RegisterDto, envService: SupabaseMode) {
    if (registerDto.username) {
      const existingUsername = await this.knexService
        .connection<UserProfileRow>('users')
        .where({
          username: registerDto.username,
        })
        .first();

      if (existingUsername) {
        throw new ConflictException('Username sudah digunakan');
      }
    }

    const supabaseClients = this.supabaseService.getClient(envService);

    const signUpResponse = await supabaseClients.auth.signUp({
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
      .where({
        id: authUser.id,
      })
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

  async login(loginDto: LoginDto, envService: SupabaseMode) {
    // const supabaseClients = this.supabaseService.getClient('prod');
    const supabaseClients = this.supabaseService.getClient(envService);

    const loginResponse = await supabaseClients.auth.signInWithPassword({
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
      .where({
        id: authUser.id,
      })
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

  async checkUser(accessToken: string, envService: SupabaseMode) {
    const supabaseClients = this.supabaseService.getClient(envService);

    const {
      data: { user: authUser },
      error,
    } = await supabaseClients.auth.getUser(accessToken);

    if (error || !authUser) {
      throw new UnauthorizedException(
        'Token tidak valid atau sudah kedaluwarsa',
      );
    }

    const profile = await this.knexService
      .connection<UserProfileRow, UserProfilePublic>('users')
      .where({
        id: authUser.id,
      })
      .select('id', 'email', 'username', 'full_name', 'created_at', 'modify_dt')
      .first();

    return {
      message: 'User ditemukan',
      user: {
        id: authUser.id,
        email: authUser.email,
        emailConfirmedAt: authUser.email_confirmed_at,
        profile: profile ?? null,
      },
    };
  }
}
