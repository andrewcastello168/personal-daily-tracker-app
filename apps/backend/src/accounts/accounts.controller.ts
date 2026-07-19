import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import type { AuthenticatedRequest } from 'src/auth/types/authenticated-request.type';

@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  @UseGuards(SupabaseAuthGuard)
  create(
    @Body() createAccountDto: CreateAccountDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const userId = request.user.id;

    return this.accountsService.create(createAccountDto, userId);
  }
}
