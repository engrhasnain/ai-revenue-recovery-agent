import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { AppConfigService } from "../../config/app-config.service";

/**
 * Guard for disabling destructive/irreversible actions in public demo mode.
 *
 * Mirrors backend-fastapi-archive/src/app/utils/demo_guard.py's
 * `block_if_public_demo` dependency — apply via `@UseGuards(PublicDemoGuard)`
 * on any endpoint that deletes data or performs another irreversible bulk
 * action, so anonymous public visitors cannot permanently damage the shared
 * demo dataset.
 */
@Injectable()
export class PublicDemoGuard implements CanActivate {
  constructor(private readonly config: AppConfigService) {}

  canActivate(_context: ExecutionContext): boolean {
    if (this.config.publicDemoMode) {
      throw new ForbiddenException("Disabled in the public demo");
    }
    return true;
  }
}
