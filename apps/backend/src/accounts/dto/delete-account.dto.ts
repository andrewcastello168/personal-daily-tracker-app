import { IsString, MaxLength } from 'class-validator';

export class DeleteAccountDto {
  @IsString()
  @MaxLength(100)
  accountName!: string;
}
