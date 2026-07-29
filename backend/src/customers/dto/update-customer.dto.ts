import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { RiskLevel } from "../../common/enums";

export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  whatsapp?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  company?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsEnum(RiskLevel)
  risk_level?: RiskLevel;

  @IsOptional()
  @IsString()
  notes?: string;
}
