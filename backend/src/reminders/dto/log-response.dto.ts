import { IsString } from "class-validator";

// IMPORTANT: this is deliberately a request-body DTO, not a query-param one.
// The archived Python backend originally leaked customer response text via a
// query parameter on this endpoint — that was fixed to a request body field
// before the demo hardening pass. Do not reintroduce a query param here.
export class LogResponseDto {
  @IsString()
  response_text!: string;
}
