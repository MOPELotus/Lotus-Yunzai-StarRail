export const Format = {
  elemName: value => value,
  comma: (value, precision = 0) => typeof value === "number" && Number.isFinite(value)
    ? new Intl.NumberFormat("zh-CN", { maximumFractionDigits: precision }).format(value)
    : String(value),
  percent: (value, precision = 1) => Format.pct(value * 100, precision),
  pct: (value, precision = 1) => `${Number(value).toFixed(precision)}%`,
};
