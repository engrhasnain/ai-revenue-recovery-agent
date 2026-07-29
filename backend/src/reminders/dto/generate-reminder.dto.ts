import { IsEnum, IsInt, IsOptional, IsString } from "class-validator";
import { ReminderChannel, ReminderType } from "../../common/enums";

export class GenerateReminderDto {
  @IsInt()
  invoice_id!: number;

  @IsEnum(ReminderChannel)
  channel!: ReminderChannel;

  @IsEnum(ReminderType)
  reminder_type!: ReminderType;

  @IsOptional()
  @IsString()
  custom_instructions?: string;
}
