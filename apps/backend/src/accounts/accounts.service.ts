import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { KnexService } from '../database/knex.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';

interface AccountRow {
  id: number;
  user_id: string;
  account_name: string;
  account_type: string;
  current_balance: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date | null;
}

interface UserRow {
  id: string;
  email: string;
  username: string;
  full_name: string;
  created_at: Date;
  modify_dt: Date | null;
}

@Injectable()
export class AccountsService {
  constructor(private readonly knexService: KnexService) {}

  async create(createAccountDto: CreateAccountDto, userId: string) {
    const { accountName, accountType, initialBalance = 0 } = createAccountDto;

    const db = this.knexService.connection;

    const existingUser = await db<UserRow>('users')
      .withSchema('public')
      .where({
        id: userId,
      })
      .first();

    if (!existingUser) {
      throw new NotFoundException(
        `User ${userId} tidak ditemukan di public.users pada database aplikasi.`,
      );
    }

    const existingAccount = await db<AccountRow>('accounts')
      .where({
        user_id: userId,
        account_name: accountName,
        is_active: true,
      })
      .first();

    if (existingAccount) {
      throw new BadRequestException(
        `Akun dengan nama "${accountName}" sudah tersedia.`,
      );
    }

    const [newAccount] = await db<AccountRow>('accounts')
      .insert({
        user_id: userId,
        account_name: accountName,
        account_type: accountType,
        current_balance: initialBalance,
        is_active: true,
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      })
      .returning('*');

    return {
      message: 'Akun berhasil dibuat.',
      data: {
        id: Number(newAccount.id),
        accountName: newAccount.account_name,
        accountType: newAccount.account_type,
        currentBalance: Number(newAccount.current_balance),
        isActive: newAccount.is_active,
      },
    };
  }

  async delete(deleteAccountDto: DeleteAccountDto, userId: string) {
    const { accountName } = deleteAccountDto;

    const db = this.knexService.connection;

    const existingUser = await db<UserRow>('users')
      .withSchema('public')
      .where('id', userId)
      .first();

    if (!existingUser) {
      throw new NotFoundException(
        `User ${userId} tidak ditemukan di public.users pada database aplikasi.`,
      );
    }

    const existingAccount = await db<AccountRow>('accounts')
      .where({
        user_id: userId,
        account_name: accountName,
        is_active: true,
      })
      .first();

    // Kalau akun tidak ditemukan, baru error
    if (!existingAccount) {
      throw new NotFoundException(
        `Akun dengan nama "${accountName}" tidak ditemukan.`,
      );
    }

    const [deletedAccount] = await db<AccountRow>('accounts')
      .where({
        id: existingAccount.id,
        user_id: userId,
      })
      .update({
        is_active: false,
        updated_at: db.fn.now(),
      })
      .returning('*');

    return {
      message: 'Akun berhasil dihapus.',
      data: {
        id: Number(deletedAccount.id),
        accountName: deletedAccount.account_name,
        accountType: deletedAccount.account_type,
        isActive: deletedAccount.is_active,
      },
    };
  }
}
