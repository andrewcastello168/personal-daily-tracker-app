import { KnexService } from './../database/knex.service';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionType } from './enums/transaction-type.enum';

interface AccountRow {
  id: number;
  user_id: string;
  account_name: string;
  account_type: string;
  current_balance: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date | null;
}

interface BudgetPeriod {
  id: number;
  user_id: string;
  start_date: string;
  end_date: string;
  saving_percentage: number;
  status: string;
  created_at: Date;
  updated_at: Date | null;
}

interface TransactionRow {
  id: number;
  user_id: string;
  account_id: number;
  budget_period_id: number;
  transaction_type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  amount: number;
  transaction_date: string;
  category: string | null;
  note: string | null;
  created_at: Date;
  updated_at: Date | null;
}

@Injectable()
export class TransactionsService {
  constructor(private readonly knexService: KnexService) {}

  private formatDateOnly(dateValue: string): string {
    return dateValue.slice(0, 10);
  }

  private getPreviousDate(dateValue: string): string {
    const date = new Date(`${dateValue}T00:00:00Z`);

    date.setUTCDate(date.getUTCDate() - 1);

    return date.toISOString().slice(0, 10);
  }

  private getOneMonthPeriodEnd(startDate: string): string {
    const date = new Date(`${startDate}T00:00:00Z`);

    date.setUTCMonth(date.getUTCMonth() + 1);
    date.setUTCDate(date.getUTCDate() - 1);

    return date.toISOString().slice(0, 10);
  }

  create(createTransactionDto: CreateTransactionDto, userId: string) {
    const {
      accountId,
      transactionType,
      amount,
      transactionDate,
      category,
      note,
      startNewPeriod = false,
      savingPercentage,
    } = createTransactionDto;

    const transactionAmount = Number(amount);

    const db = this.knexService.connection;

    return db.transaction(async (trx) => {
      /**
       * 1. Validasi akun
       *
       * Akun harus:
       * - Ada
       * - Aktif
       * - Milik user yang login
       *
       * forUpdate() juga mengunci baris akun agar saldo tidak
       * bentrok ketika ada dua transaksi bersamaan.
       */
      const account = await db<AccountRow>('accounts')
        .where({
          id: accountId,
          user_id: userId,
          is_active: true,
        })
        .forUpdate()
        .first();

      if (!account) {
        throw new NotFoundException(
          'Akun tidak ditemukan atau bukan milik user.',
        );
      }

      /**
       * 2. Validasi tipe transaksi
       */
      if (startNewPeriod && transactionType !== TransactionType.INCOME) {
        throw new BadRequestException(
          'Hanya transaksi pemasukan yang dapat memulai periode baru.',
        );
      }

      /**
       * 3. Cari periode aktif user
       */
      let activePeriod = await trx<BudgetPeriod>('budget_periods')
        .where({
          user_id: userId,
          status: 'ACTIVE',
        })
        .forUpdate()
        .first();

      /**
       * 4. Jika income memulai periode baru
       */
      if (startNewPeriod) {
        if (savingPercentage === undefined || savingPercentage === null) {
          throw new BadRequestException(
            'Persentase tabungan wajib diisi saat memulai periode baru.',
          );
        }

        const percentage = Number(savingPercentage);

        if (percentage < 0 || percentage > 100) {
          throw new BadRequestException(
            'Persentase tabungan harus antara 0 sampai 100.',
          );
        }

        const periodStartDate = this.formatDateOnly(transactionDate);

        /**
         * Tutup periode lama, tetapi transaksi lama tidak dihapus.
         */
        if (activePeriod) {
          const previousDate = this.getPreviousDate(periodStartDate);

          await trx('budget_periods')
            .where({
              id: activePeriod.id,
              user_id: userId,
            })
            .update({
              end_date: previousDate,
              status: 'CLOSED',
              updated_at: trx.fn.now(),
            });
        }

        /**
         * Untuk MVP, periode dibuat selama satu bulan:
         * 25 Juli sampai 24 Agustus.
         */
        const periodEndDate = this.getOneMonthPeriodEnd(periodStartDate);

        const [newPeriod] = await trx<BudgetPeriod>('budget_periods')
          .insert({
            user_id: userId,
            start_date: periodStartDate,
            end_date: periodEndDate,
            saving_percentage: percentage,
            status: 'ACTIVE',
            created_at: trx.fn.now(),
            updated_at: trx.fn.now(),
          })
          .returning('*');

        activePeriod = newPeriod;
      }

      /**
       * Semua transaksi harus masuk ke periode aktif.
       */
      if (!activePeriod) {
        throw new BadRequestException(
          'Belum ada periode budgeting aktif. Mulai periode baru terlebih dahulu.',
        );
      }

      /**
       * 5. Validasi expense
       */
      if (transactionType === TransactionType.EXPENSE) {
        const currentBalance = Number(account.current_balance);

        if (currentBalance < transactionAmount) {
          throw new BadRequestException('Saldo akun tidak mencukupi.');
        }
      }

      /**
       * 6. Insert transaksi
       */
      const [newTransaction] = await trx<TransactionRow>('transactions')
        .insert({
          user_id: userId,
          account_id: accountId,
          budget_period_id: activePeriod.id,
          transaction_type: transactionType,
          amount: transactionAmount,
          transaction_date: transactionDate,
          category: category ?? null,
          note: note ?? null,
          created_at: trx.fn.now(),
          updated_at: trx.fn.now(),
        })
        .returning('*');

      /**
       * 7. Update saldo account
       *
       * Gunakan increment/decrement langsung agar aman
       * dari request bersamaan.
       */
      if (transactionType === TransactionType.INCOME) {
        await trx('accounts')
          .where({
            id: accountId,
            user_id: userId,
          })
          .increment('current_balance', transactionAmount)
          .update({
            updated_at: trx.fn.now(),
          });
      }

      if (transactionType === TransactionType.EXPENSE) {
        await trx('accounts')
          .where({
            id: accountId,
            user_id: userId,
          })
          .decrement('current_balance', transactionAmount)
          .update({
            updated_at: trx.fn.now(),
          });
      }

      /**
       * TRANSFER belum diproses di sini karena membutuhkan:
       * sourceAccountId dan destinationAccountId.
       */
      if (transactionType === TransactionType.TRANSFER) {
        throw new BadRequestException('Transaksi transfer belum didukung.');
      }

      /**
       * 8. Ambil saldo terbaru
       */
      const updatedAccount = await trx<AccountRow>('accounts')
        .where({
          id: accountId,
          user_id: userId,
        })
        .first();

      if (!updatedAccount) {
        throw new NotFoundException(
          'Akun tidak ditemukan setelah transaksi diproses.',
        );
      }

      return {
        message: 'Transaksi berhasil dibuat.',
        data: {
          transaction: {
            id: newTransaction.id,
            transactionType: newTransaction.transaction_type,
            amount: Number(newTransaction.amount),
            transactionDate: newTransaction.transaction_date,
            category: newTransaction.category,
            note: newTransaction.note,
          },
          account: {
            id: updatedAccount.id,
            accountName: updatedAccount.account_name,
            currentBalance: Number(updatedAccount.current_balance),
          },
          budgetPeriod: {
            id: activePeriod.id,
            startDate: activePeriod.start_date,
            endDate: activePeriod.end_date,
            savingPercentage: Number(activePeriod.saving_percentage),
            status: activePeriod.status,
          },
        },
      };
    });
  }

  findAll() {
    return `This action returns all transactions`;
  }

  findOne(id: number) {
    return `This action returns a #${id} transaction`;
  }

  update(id: number, updateTransactionDto: UpdateTransactionDto) {
    return `This action updates a #${id} transaction`;
  }

  remove(id: number) {
    return `This action removes a #${id} transaction`;
  }
}
