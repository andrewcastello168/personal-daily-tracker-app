import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { SupabaseAuthGuard } from 'src/auth/guards/supabase-auth.guard';
import type { AuthenticatedRequest } from 'src/auth/types/authenticated-request.type';
import { TransactionType } from './enums/transaction-type.enum';

@Controller('transactions')
@UseGuards(SupabaseAuthGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  /**
   * POST /transactions
   *
   * Membuat transaksi income atau expense.
   */
  @Post()
  create(
    @Body() createTransactionDto: CreateTransactionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.transactionsService.create(
      createTransactionDto,
      request.user.id,
    );
  }

  /**
   * GET /transactions
   *
   * Contoh:
   * /transactions?page=1&limit=20
   * /transactions?transactionType=EXPENSE
   * /transactions?accountId=1
   * /transactions?startDate=2026-07-01&endDate=2026-07-31
   */
  @Get()
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('accountId') accountId?: string,
    @Query(
      'transactionType',
      new ParseEnumPipe(TransactionType, { optional: true }),
    )
    transactionType?: TransactionType,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.transactionsService.findAll(request.user.id, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      accountId: accountId ? Number(accountId) : undefined,
      transactionType,
      startDate,
      endDate,
    });
  }

  /**
   * GET /transactions/:id
   */
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.transactionsService.findOne(id, request.user.id);
  }

  /**
   * PATCH /transactions/:id
   */
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTransactionDto: UpdateTransactionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.transactionsService.update(
      id,
      updateTransactionDto,
      request.user.id,
    );
  }

  /**
   * DELETE /transactions/:id
   */
  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.transactionsService.remove(id, request.user.id);
  }
}
