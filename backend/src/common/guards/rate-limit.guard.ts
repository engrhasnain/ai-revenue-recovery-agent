import { ExecutionContext, HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { ThrottlerGuard, ThrottlerLimitDetail } from "@nestjs/throttler";

/**
 * Formats the 429 body to match slowapi's message in
 * backend-fastapi-archive/src/app/utils/rate_limit.py:
 * `{"detail": "You've hit the rate limit for this public demo (...). Please wait a bit and try again."}`
 */
@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  protected async throwThrottlingException(_context: ExecutionContext, throttlerLimitDetail: ThrottlerLimitDetail): Promise<void> {
    const { limit, ttl } = throttlerLimitDetail;
    const perWindow = ttl >= 3600000 ? `${limit} per ${Math.round(ttl / 3600000)} hour` : `${limit} per ${Math.round(ttl / 1000)} seconds`;
    throw new HttpException(
      { detail: `You've hit the rate limit for this public demo (${perWindow}). Please wait a bit and try again.` },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
