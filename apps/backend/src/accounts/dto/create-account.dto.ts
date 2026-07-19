import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export enum AccountType {
  BANK = 'BANK',
  E_WALLET = 'E_WALLET',
  CASH = 'CASH',
}

export class CreateAccountDto {
  @IsString()
  @MaxLength(100)
  accountName!: string;

  @IsEnum(AccountType)
  accountType!: AccountType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  initialBalance?: number;
}
