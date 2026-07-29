import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { Response } from "express";

/**
 * Reshapes every error response into FastAPI's `{"detail": ...}` envelope.
 *
 * The frontend reads `err.response.data.detail` directly (see
 * frontend/src/app/customers/page.tsx and invoices/page.tsx), which matches
 * FastAPI's default HTTPException body. Nest's default body shape is
 * `{statusCode, message, error}` — without this filter every error toast in
 * the UI would silently fall back to its generic message instead of showing
 * the real reason (e.g. "Customer with this email already exists").
 */
@Catch()
export class DetailExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("ExceptionFilter");

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let detail: unknown = "Internal server error";

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();

      if (typeof body === "string") {
        detail = body;
      } else if (body && typeof body === "object") {
        const obj = body as Record<string, unknown>;
        if ("detail" in obj) {
          detail = obj.detail;
        } else if (Array.isArray(obj.message)) {
          detail = (obj.message as unknown[]).join("; ");
        } else if (typeof obj.message === "string") {
          detail = obj.message;
        } else {
          detail = obj;
        }
      }
    } else {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    response.status(status).json({ detail });
  }
}
