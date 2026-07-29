// Small helper replicating Python's str.format(**kwargs) for the subset of
// placeholders used by the reminder templates (plain `{name}` and
// `{amount_due:.2f}` fixed-point formatting).

export function fmt(template: string, ctx: Record<string, unknown>): string {
  return template.replace(/\{(\w+)(?::([^}]+))?\}/g, (_match, key: string, spec: string | undefined) => {
    const value = ctx[key];
    if (spec === ".2f") {
      return Number(value).toFixed(2);
    }
    return String(value ?? "");
  });
}

export function fmtMoney(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${Math.round(amount / 1_000)}k`;
  return `$${Math.round(amount)}`;
}
