import { IsDateString, IsInt, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from "class-validator";

export class CreateInvoiceDto {
  @IsString()
  @MaxLength(100)
  invoice_number!: string;

  @IsInt()
  customer_id!: number;

  @IsNumber()
  @IsPositive({ message: "Amount must be positive" })
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency: string = "USD";

  @IsDateString()
  issue_date!: string;

  @IsDateString()
  due_date!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
