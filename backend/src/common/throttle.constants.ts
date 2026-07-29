// Rate limit tiers — mirrors backend-fastapi-archive/src/app/utils/rate_limit.py.
//
// Generous default (120/hour) applies globally via the ThrottlerModule
// config in app.module.ts; AI-calling endpoints override it per-route with
// this stricter budget (20/hour) since those are the only calls that could
// incur real cost from anonymous public traffic if a live API key is set.
export const ONE_HOUR_MS = 60 * 60 * 1000;

export const AI_THROTTLE = { default: { limit: 20, ttl: ONE_HOUR_MS } };
