import { IsInt, IsNotEmpty, IsPositive, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class BuySharesDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  accountId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  shareCount: number;
}
