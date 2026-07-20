import { KnexService } from './../database/knex.service';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransactionType } from './enums/transaction-type.enum';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

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
  transaction_type: TransactionType;
  destination_account_id: number | null;
  amount: number;
  transaction_date: string;
  category: string | null;
  note: string | null;
  created_at: Date;
  updated_at: Date | null;
}

interface TransactionDetailRow {
  id: number | string;
  accountId: number | string;
  accountName: string;
  accountType: string;
  currentBalance: number | string;
  budgetPeriodId: number | string;
  periodStartDate: string;
  periodEndDate: string;
  savingPercentage: number | string;
  periodStatus: string;
  transactionType: TransactionType;
  amount: number | string;
  transactionDate: string;
  category: string | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}

type TransactionFilters = {
  page?: number | string;
  limit?: number | string;
  accountId?: number | string;
  transactionType?: TransactionType;
  startDate?: string;
  endDate?: string;
  category?: string;
};

type TransactionListRow = {
  id: string | number;
  accountId: string | number | null;
  accountName: string | null;
  accountType: string | null;
  budgetPeriodId: string | number | null;
  periodStartDate: Date | string | null;
  periodEndDate: Date | string | null;
  transactionType: TransactionType;
  amount: string | number;
  transactionDate: Date | string;
  category: string;
  note: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

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
      destinationAccountId,
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
       * 1. Validasi tipe transaksi dan akun tujuan transfer
       */
      if (
        transactionType === TransactionType.TRANSFER &&
        destinationAccountId === undefined
      ) {
        throw new BadRequestException(
          'Akun tujuan wajib diisi untuk transaksi transfer.',
        );
      }

      if (
        transactionType === TransactionType.TRANSFER &&
        accountId === destinationAccountId
      ) {
        throw new BadRequestException(
          'Akun sumber dan akun tujuan tidak boleh sama.',
        );
      }

      if (startNewPeriod && transactionType !== TransactionType.INCOME) {
        throw new BadRequestException(
          'Hanya transaksi pemasukan yang dapat memulai periode baru.',
        );
      }

      /**
       * 2. Ambil dan kunci akun sumber/utama.
       *
       * INCOME  = akun penerima
       * EXPENSE = akun pengeluaran
       * TRANSFER = akun sumber
       */
      const account = await trx<AccountRow>('accounts')
        .where({
          id: accountId,
          user_id: userId,
          is_active: true,
        })
        .forUpdate()
        .first();

      if (!account) {
        throw new NotFoundException(
          'Akun tidak ditemukan, tidak aktif, atau bukan milik user.',
        );
      }

      /**
       * 3. Jika transfer, ambil dan kunci akun tujuan
       */
      let destinationAccount: AccountRow | undefined;

      if (
        transactionType === TransactionType.TRANSFER &&
        destinationAccountId !== undefined
      ) {
        destinationAccount = await trx<AccountRow>('accounts')
          .where({
            id: destinationAccountId,
            user_id: userId,
            is_active: true,
          })
          .forUpdate()
          .first();

        if (!destinationAccount) {
          throw new NotFoundException(
            'Akun tujuan tidak ditemukan, tidak aktif, atau bukan milik user.',
          );
        }
      }

      /**
       * 4. Cari periode budgeting aktif
       */
      let activePeriod = await trx<BudgetPeriod>('budget_periods')
        .where({
          user_id: userId,
          status: 'ACTIVE',
        })
        .forUpdate()
        .first();

      /**
       * 5. Jika income memulai periode baru
       */
      if (startNewPeriod) {
        if (savingPercentage === undefined) {
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
       * Semua transaksi harus berada di periode aktif.
       */
      if (!activePeriod) {
        throw new BadRequestException(
          'Belum ada periode budgeting aktif. Mulai periode baru terlebih dahulu.',
        );
      }

      /**
       * 6. Validasi saldo.
       *
       * Expense dan transfer sama-sama mengurangi akun utama/sumber.
       */
      if (
        transactionType === TransactionType.EXPENSE ||
        transactionType === TransactionType.TRANSFER
      ) {
        const currentBalance = Number(account.current_balance);

        if (currentBalance < transactionAmount) {
          throw new BadRequestException('Saldo akun sumber tidak mencukupi.');
        }
      }

      /**
       * 7. Insert transaksi
       */
      const [newTransaction] = await trx<TransactionRow>('transactions')
        .insert({
          user_id: userId,
          account_id: accountId,

          destination_account_id:
            transactionType === TransactionType.TRANSFER
              ? destinationAccountId
              : null,

          budget_period_id: activePeriod.id,
          transaction_type: transactionType,
          amount: transactionAmount,
          transaction_date: this.formatDateOnly(transactionDate),
          category:
            category ??
            (transactionType === TransactionType.TRANSFER
              ? 'Transfer antar akun'
              : null),
          note: note ?? null,
          created_at: trx.fn.now(),
          updated_at: trx.fn.now(),
        })
        .returning('*');

      /**
       * 8. Update saldo berdasarkan tipe transaksi
       */
      switch (transactionType) {
        case TransactionType.INCOME:
          await trx('accounts')
            .where({
              id: accountId,
              user_id: userId,
            })
            .increment('current_balance', transactionAmount)
            .update({
              updated_at: trx.fn.now(),
            });
          break;

        case TransactionType.EXPENSE:
          await trx('accounts')
            .where({
              id: accountId,
              user_id: userId,
            })
            .decrement('current_balance', transactionAmount)
            .update({
              updated_at: trx.fn.now(),
            });
          break;

        case TransactionType.TRANSFER:
          if (destinationAccountId === undefined || !destinationAccount) {
            throw new BadRequestException(
              'Data akun tujuan transfer tidak valid.',
            );
          }

          /**
           * Kurangi akun sumber
           */
          await trx('accounts')
            .where({
              id: accountId,
              user_id: userId,
            })
            .decrement('current_balance', transactionAmount)
            .update({
              updated_at: trx.fn.now(),
            });

          /**
           * Tambah akun tujuan
           */
          await trx('accounts')
            .where({
              id: destinationAccountId,
              user_id: userId,
            })
            .increment('current_balance', transactionAmount)
            .update({
              updated_at: trx.fn.now(),
            });
          break;

        default:
          throw new BadRequestException('Tipe transaksi tidak valid.');
      }

      /**
       * 9. Ambil saldo akun terbaru
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

      let updatedDestinationAccount: AccountRow | undefined;

      if (
        transactionType === TransactionType.TRANSFER &&
        destinationAccountId !== undefined
      ) {
        updatedDestinationAccount = await trx<AccountRow>('accounts')
          .where({
            id: destinationAccountId,
            user_id: userId,
          })
          .first();

        if (!updatedDestinationAccount) {
          throw new NotFoundException(
            'Akun tujuan tidak ditemukan setelah transfer diproses.',
          );
        }
      }

      return {
        message:
          transactionType === TransactionType.TRANSFER
            ? 'Transfer antar akun berhasil dibuat.'
            : 'Transaksi berhasil dibuat.',

        data: {
          transaction: {
            id: newTransaction.id,
            transactionType: newTransaction.transaction_type,
            amount: Number(newTransaction.amount),
            transactionDate: newTransaction.transaction_date,
            category: newTransaction.category,
            note: newTransaction.note,

            sourceAccountId: newTransaction.account_id,

            destinationAccountId: newTransaction.destination_account_id,
          },

          account: {
            id: updatedAccount.id,
            accountName: updatedAccount.account_name,
            currentBalance: Number(updatedAccount.current_balance),
          },

          destinationAccount: updatedDestinationAccount
            ? {
                id: updatedDestinationAccount.id,
                accountName: updatedDestinationAccount.account_name,
                currentBalance: Number(
                  updatedDestinationAccount.current_balance,
                ),
              }
            : null,

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

  async findAll(userId: string, filters: TransactionFilters = {}) {
    const db = this.knexService.connection;

    const page = Number(filters.page ?? 1);
    const limit = Number(filters.limit ?? 20);

    if (!Number.isInteger(page) || page < 1) {
      throw new BadRequestException('Page minimal bernilai 1.');
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException('Limit harus berada antara 1 sampai 100.');
    }

    if (
      filters.transactionType !== undefined &&
      !Object.values(TransactionType).includes(filters.transactionType)
    ) {
      throw new BadRequestException('Tipe transaksi tidak valid.');
    }

    const offset = (page - 1) * limit;

    const baseQuery = db('transactions as t').where('t.user_id', userId);

    if (filters.accountId !== undefined) {
      baseQuery.where('t.account_id', filters.accountId);
    }

    if (filters.transactionType !== undefined) {
      baseQuery.where('t.transaction_type', filters.transactionType);
    }

    if (filters.startDate) {
      baseQuery.where(
        't.transaction_date',
        '>=',
        this.formatDateOnly(filters.startDate),
      );
    }

    if (filters.endDate) {
      baseQuery.where(
        't.transaction_date',
        '<=',
        this.formatDateOnly(filters.endDate),
      );
    }

    if (filters.category) {
      baseQuery.whereILike('t.category', `%${filters.category}%`);
    }

    const countResult = await baseQuery
      .clone()
      .count<{ count: string | number }[]>({
        count: 't.id',
      });

    const total = Number(countResult[0]?.count ?? 0);

    const transactions = await baseQuery
      .clone()
      .leftJoin('accounts as a', function () {
        this.on('a.id', '=', 't.account_id').andOn(
          'a.user_id',
          '=',
          't.user_id',
        );
      })
      .leftJoin('budget_periods as bp', function () {
        this.on('bp.id', '=', 't.budget_period_id').andOn(
          'bp.user_id',
          '=',
          't.user_id',
        );
      })
      .select<TransactionListRow[]>({
        id: 't.id',
        accountId: 't.account_id',
        accountName: 'a.account_name',
        accountType: 'a.account_type',
        budgetPeriodId: 't.budget_period_id',
        periodStartDate: 'bp.start_date',
        periodEndDate: 'bp.end_date',
        transactionType: 't.transaction_type',
        amount: 't.amount',
        transactionDate: 't.transaction_date',
        category: 't.category',
        note: 't.note',
        createdAt: 't.created_at',
        updatedAt: 't.updated_at',
      })
      .orderBy('t.transaction_date', 'desc')
      .orderBy('t.id', 'desc')
      .limit(limit)
      .offset(offset);

    return {
      message: 'Daftar transaksi berhasil diambil.',
      data: transactions.map((transaction) => ({
        ...transaction,
        id: Number(transaction.id),

        accountId:
          transaction.accountId === null ? null : Number(transaction.accountId),

        budgetPeriodId:
          transaction.budgetPeriodId === null
            ? null
            : Number(transaction.budgetPeriodId),

        amount: Number(transaction.amount),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, userId: string) {
    const db = this.knexService.connection;

    const transaction = await db('transactions as t')
      .leftJoin('accounts as a', function () {
        this.on('a.id', '=', 't.account_id').andOn(
          'a.user_id',
          '=',
          't.user_id',
        );
      })
      .leftJoin('budget_periods as bp', function () {
        this.on('bp.id', '=', 't.budget_period_id').andOn(
          'bp.user_id',
          '=',
          't.user_id',
        );
      })
      .where({
        't.id': id,
        't.user_id': userId,
      })
      .select({
        id: 't.id',
        accountId: 't.account_id',
        accountName: 'a.account_name',
        accountType: 'a.account_type',
        currentBalance: 'a.current_balance',
        budgetPeriodId: 't.budget_period_id',
        periodStartDate: 'bp.start_date',
        periodEndDate: 'bp.end_date',
        savingPercentage: 'bp.saving_percentage',
        periodStatus: 'bp.status',
        transactionType: 't.transaction_type',
        amount: 't.amount',
        transactionDate: 't.transaction_date',
        category: 't.category',
        note: 't.note',
        createdAt: 't.created_at',
        updatedAt: 't.updated_at',
      })
      .first<TransactionDetailRow>();

    if (!transaction) {
      throw new NotFoundException(
        'Transaksi tidak ditemukan atau bukan milik user.',
      );
    }

    return {
      message: 'Detail transaksi berhasil diambil.',
      data: {
        ...transaction,
        id: Number(transaction.id),
        accountId: Number(transaction.accountId),
        currentBalance: Number(transaction.currentBalance),
        budgetPeriodId: Number(transaction.budgetPeriodId),
        savingPercentage: Number(transaction.savingPercentage),
        amount: Number(transaction.amount),
      },
    };
  }

  async update(
    id: number,
    updateTransactionDto: UpdateTransactionDto,
    userId: string,
  ) {
    const db = this.knexService.connection;

    return db.transaction(async (trx) => {
      /*
       * Ambil transaksi lama dan kunci row transaksi.
       */
      const existingTransaction = await trx<TransactionRow>('transactions')
        .where({
          id,
          user_id: userId,
        })
        .forUpdate()
        .first();

      if (!existingTransaction) {
        throw new NotFoundException(
          'Transaksi tidak ditemukan atau bukan milik user.',
        );
      }

      if (existingTransaction.transaction_type === TransactionType.TRANSFER) {
        throw new BadRequestException(
          'Update transaksi transfer belum didukung.',
        );
      }

      const newAccountId =
        updateTransactionDto.accountId ?? existingTransaction.account_id;

      const newTransactionType =
        updateTransactionDto.transactionType ??
        existingTransaction.transaction_type;

      const newAmount =
        updateTransactionDto.amount !== undefined
          ? Number(updateTransactionDto.amount)
          : Number(existingTransaction.amount);

      const newTransactionDate = this.formatDateOnly(
        updateTransactionDto.transactionDate ??
          existingTransaction.transaction_date,
      );

      const newCategory =
        updateTransactionDto.category === undefined
          ? existingTransaction.category
          : updateTransactionDto.category;

      const newNote =
        updateTransactionDto.note === undefined
          ? existingTransaction.note
          : updateTransactionDto.note;

      if (!Number.isFinite(newAmount) || newAmount <= 0) {
        throw new BadRequestException(
          'Nominal transaksi harus lebih besar dari nol.',
        );
      }

      if (newTransactionType === TransactionType.TRANSFER) {
        throw new BadRequestException('Transaksi transfer belum didukung.');
      }

      /*
       * Cari budget period berdasarkan tanggal transaksi yang baru.
       *
       * Ini penting karena transaksi lama mungkin berada pada periode
       * yang sudah CLOSED, bukan selalu periode yang ACTIVE.
       */
      const targetPeriod = await trx<BudgetPeriod>('budget_periods')
        .where('user_id', userId)
        .where('start_date', '<=', newTransactionDate)
        .where('end_date', '>=', newTransactionDate)
        .orderBy('start_date', 'desc')
        .first();

      if (!targetPeriod) {
        throw new BadRequestException(
          'Tidak ditemukan periode budgeting untuk tanggal transaksi tersebut.',
        );
      }

      /*
       * Lock akun lama dan akun tujuan baru.
       *
       * Kalau accountId tidak berubah, hanya satu account yang dikunci.
       */
      const accountIds = Array.from(
        new Set([existingTransaction.account_id, newAccountId]),
      ).sort((firstId, secondId) => firstId - secondId);

      const accounts = await trx<AccountRow>('accounts')
        .where('user_id', userId)
        .whereIn('id', accountIds)
        .orderBy('id')
        .forUpdate();

      const oldAccount = accounts.find(
        (account) => Number(account.id) === existingTransaction.account_id,
      );

      const targetAccount = accounts.find(
        (account) => Number(account.id) === newAccountId,
      );

      if (!oldAccount) {
        throw new NotFoundException(
          'Akun dari transaksi sebelumnya tidak ditemukan.',
        );
      }

      if (!targetAccount) {
        throw new NotFoundException(
          'Akun tujuan tidak ditemukan atau bukan milik user.',
        );
      }

      /*
       * Kalau pindah ke akun lain, akun tujuan harus aktif.
       *
       * Akun lama yang sudah nonaktif masih diperbolehkan agar transaksi
       * lamanya tetap dapat dikoreksi.
       */
      if (
        newAccountId !== existingTransaction.account_id &&
        !targetAccount.is_active
      ) {
        throw new BadRequestException('Akun tujuan sudah tidak aktif.');
      }

      /*
       * Hitung perubahan saldo tanpa langsung menyentuh database.
       *
       * Pertama, batalkan efek transaksi lama.
       * Kedua, terapkan efek transaksi yang baru.
       */
      const balanceDeltas = new Map<number, number>();

      const addBalanceDelta = (accountId: number, amountDelta: number) => {
        const currentDelta = balanceDeltas.get(accountId) ?? 0;

        balanceDeltas.set(accountId, currentDelta + amountDelta);
      };

      const oldAmount = Number(existingTransaction.amount);

      /*
       * Membatalkan efek transaksi lama:
       *
       * INCOME lama  -> saldo dikurangi
       * EXPENSE lama -> saldo ditambah kembali
       */
      if (existingTransaction.transaction_type === TransactionType.INCOME) {
        addBalanceDelta(existingTransaction.account_id, -oldAmount);
      }

      if (existingTransaction.transaction_type === TransactionType.EXPENSE) {
        addBalanceDelta(existingTransaction.account_id, oldAmount);
      }

      /*
       * Menerapkan efek transaksi baru:
       *
       * INCOME baru  -> saldo ditambah
       * EXPENSE baru -> saldo dikurangi
       */
      if (newTransactionType === TransactionType.INCOME) {
        addBalanceDelta(newAccountId, newAmount);
      }

      if (newTransactionType === TransactionType.EXPENSE) {
        addBalanceDelta(newAccountId, -newAmount);
      }

      /*
       * Pastikan saldo akhir setiap account tidak menjadi negatif.
       */
      for (const [affectedAccountId, balanceDelta] of balanceDeltas) {
        const account = accounts.find(
          (item) => Number(item.id) === affectedAccountId,
        );

        if (!account) {
          throw new NotFoundException(
            `Akun ${affectedAccountId} tidak ditemukan.`,
          );
        }

        const finalBalance = Number(account.current_balance) + balanceDelta;

        if (finalBalance < 0) {
          throw new BadRequestException(
            `Saldo akun "${account.account_name}" tidak mencukupi untuk perubahan transaksi ini.`,
          );
        }
      }

      /*
       * Terapkan perubahan saldo.
       */
      for (const [affectedAccountId, balanceDelta] of balanceDeltas) {
        if (balanceDelta === 0) {
          continue;
        }

        await trx('accounts')
          .where({
            id: affectedAccountId,
            user_id: userId,
          })
          .update({
            current_balance: trx.raw('current_balance + ?', [balanceDelta]),
            updated_at: trx.fn.now(),
          });
      }

      /*
       * Update transaksi.
       */
      const [updatedTransaction] = await trx<TransactionRow>('transactions')
        .where({
          id,
          user_id: userId,
        })
        .update({
          account_id: newAccountId,
          budget_period_id: targetPeriod.id,
          transaction_type: newTransactionType,
          amount: newAmount,
          transaction_date: newTransactionDate,
          category: newCategory ?? null,
          note: newNote ?? null,
          updated_at: trx.fn.now(),
        })
        .returning('*');

      const updatedAccounts = await trx<AccountRow>('accounts')
        .where('user_id', userId)
        .whereIn('id', accountIds)
        .orderBy('id');

      return {
        message: 'Transaksi berhasil diperbarui.',
        data: {
          transaction: {
            id: Number(updatedTransaction.id),
            accountId: Number(updatedTransaction.account_id),
            budgetPeriodId: Number(updatedTransaction.budget_period_id),
            transactionType: updatedTransaction.transaction_type,
            amount: Number(updatedTransaction.amount),
            transactionDate: updatedTransaction.transaction_date,
            category: updatedTransaction.category,
            note: updatedTransaction.note,
          },
          affectedAccounts: updatedAccounts.map((account) => ({
            id: Number(account.id),
            accountName: account.account_name,
            currentBalance: Number(account.current_balance),
            isActive: account.is_active,
          })),
          budgetPeriod: {
            id: Number(targetPeriod.id),
            startDate: targetPeriod.start_date,
            endDate: targetPeriod.end_date,
            savingPercentage: Number(targetPeriod.saving_percentage),
            status: targetPeriod.status,
          },
        },
      };
    });
  }

  async remove(id: number, userId: string) {
    const db = this.knexService.connection;

    return db.transaction(async (trx) => {
      /*
       * Ambil transaksi dan kunci row-nya.
       */
      const existingTransaction = await trx<TransactionRow>('transactions')
        .where({
          id,
          user_id: userId,
        })
        .forUpdate()
        .first();

      if (!existingTransaction) {
        throw new NotFoundException(
          'Transaksi tidak ditemukan atau bukan milik user.',
        );
      }

      if (existingTransaction.transaction_type === TransactionType.TRANSFER) {
        throw new BadRequestException(
          'Hapus transaksi transfer belum didukung.',
        );
      }

      /*
       * Kunci account karena saldonya akan dikembalikan.
       */
      const account = await trx<AccountRow>('accounts')
        .where({
          id: existingTransaction.account_id,
          user_id: userId,
        })
        .forUpdate()
        .first();

      if (!account) {
        throw new NotFoundException('Akun transaksi tidak ditemukan.');
      }

      const transactionAmount = Number(existingTransaction.amount);

      /*
       * Batalkan efek transaksi.
       *
       * Hapus INCOME:
       * saldo dikurangi kembali.
       *
       * Hapus EXPENSE:
       * saldo ditambahkan kembali.
       */
      const balanceDelta =
        existingTransaction.transaction_type === TransactionType.INCOME
          ? -transactionAmount
          : transactionAmount;

      const finalBalance = Number(account.current_balance) + balanceDelta;

      if (finalBalance < 0) {
        throw new BadRequestException(
          'Transaksi pemasukan tidak dapat dihapus karena saldonya sudah digunakan.',
        );
      }

      await trx('accounts')
        .where({
          id: account.id,
          user_id: userId,
        })
        .update({
          current_balance: trx.raw('current_balance + ?', [balanceDelta]),
          updated_at: trx.fn.now(),
        });

      const [deletedTransaction] = await trx<TransactionRow>('transactions')
        .where({
          id,
          user_id: userId,
        })
        .delete()
        .returning('*');

      const updatedAccount = await trx<AccountRow>('accounts')
        .where({
          id: account.id,
          user_id: userId,
        })
        .first();

      if (!updatedAccount) {
        throw new NotFoundException(
          'Akun tidak ditemukan setelah transaksi dihapus.',
        );
      }

      return {
        message: 'Transaksi berhasil dihapus.',
        data: {
          transaction: {
            id: Number(deletedTransaction.id),
            transactionType: deletedTransaction.transaction_type,
            amount: Number(deletedTransaction.amount),
            transactionDate: deletedTransaction.transaction_date,
            category: deletedTransaction.category,
            note: deletedTransaction.note,
          },
          account: {
            id: Number(updatedAccount.id),
            accountName: updatedAccount.account_name,
            currentBalance: Number(updatedAccount.current_balance),
          },
        },
      };
    });
  }
}
