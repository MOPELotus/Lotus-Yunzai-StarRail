export const Format = {
  elemName: <T>(value: T): T => value,
  comma: (value: unknown, precision = 0) => typeof value === "number" && Number.isFinite(value)
    ? new Intl.NumberFormat("zh-CN", { maximumFractionDigits: precision }).format(value)
    : String(value),
  percent: (value: number, precision = 1) => Format.pct(value * 100, precision),
  pct: (value: number, precision = 1) => `${Number(value).toFixed(precision)}%`,
};
