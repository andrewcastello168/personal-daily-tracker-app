import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SupabaseMode } from 'src/supabase/supabase.config';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    const envService = process.env.APP_ENV as SupabaseMode;
    return this.authService.register(registerDto, envService);
  }

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    const envService = process.env.APP_ENV as SupabaseMode;
    return this.authService.login(loginDto, envService);
  }

  @UseGuards(SupabaseAuthGuard)
  @Get('me')
  getMe(
    @Headers('authorization') authorization?: string,
    // @Headers('x-supabase-mode') mode?: string,
  ) {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer token tidak ditemukan');
    }
    const envService = process.env.APP_ENV as SupabaseMode;

    // if (mode !== 'sim' && mode !== 'prod') {
    //   throw new BadRequestException(
    //     'Header x-supabase-mode harus sim atau prod',
    //   );
    // }

    const accessToken = authorization.substring(7);

    return this.authService.checkUser(accessToken, envService);
  }
}
