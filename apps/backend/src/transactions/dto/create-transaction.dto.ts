import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TransactionType } from '../enums/transaction-type.enum';

export class CreateTransactionDto {
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  accountId!: number;

  @IsEnum(TransactionType)
  transactionType!: TransactionType;

  @IsNumber({
    maxDecimalPlaces: 2,
  })
  @Min(0.01)
  @Type(() => Number)
  amount!: number;

  @IsDateString()
  transactionDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;

  /**
   * Hanya digunakan ketika transactionType = INCOME.
   * Jika true, backend menutup periode aktif dan membuat periode baru.
   */
  @ValidateIf(
    (dto: CreateTransactionDto) =>
      dto.transactionType === TransactionType.INCOME,
  )
  @IsOptional()
  @IsBoolean()
  startNewPeriod?: boolean;

  /**
   * Wajib dikirim jika startNewPeriod = true.
   */
  @ValidateIf((dto: CreateTransactionDto) => dto.startNewPeriod === true)
  @IsNumber({
    maxDecimalPlaces: 2,
  })
  @Min(0)
  @Type(() => Number)
  savingPercentage?: number;
}
