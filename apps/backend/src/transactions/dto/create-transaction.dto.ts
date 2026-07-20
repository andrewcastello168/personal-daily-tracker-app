import {
  IsBoolean,
  IsDateString,
  IsDefined,
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

  @ValidateIf(
    (dto: CreateTransactionDto) =>
      dto.transactionType === TransactionType.TRANSFER,
  )
  @IsDefined({
    message: 'destinationAccountId wajib diisi untuk transaksi transfer.',
  })
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  destinationAccountId?: number;

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

  @ValidateIf(
    (dto: CreateTransactionDto) =>
      dto.transactionType === TransactionType.INCOME,
  )
  @IsOptional()
  @IsBoolean()
  startNewPeriod?: boolean;

  @ValidateIf((dto: CreateTransactionDto) => dto.startNewPeriod === true)
  @IsDefined({
    message:
      'savingPercentage wajib diisi ketika startNewPeriod bernilai true.',
  })
  @IsNumber({
    maxDecimalPlaces: 2,
  })
  @Min(0)
  @Type(() => Number)
  savingPercentage?: number;
}
