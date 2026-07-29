import { IsDateString, IsEnum, IsNumber, IsOptional, IsString } from "class-validator";
import { InvoiceStatus } from "../../common/enums";

export class UpdateInvoiceDto {
  @IsOptional()
  @IsNumber()
  amount_paid?: number;

  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @IsOptional()
  @IsDateString()
  due_date?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
