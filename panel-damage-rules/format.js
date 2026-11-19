export const Format = {
  elemName: value => value,
  comma: (value, precision = 0) => typeof value === "number" && Number.isFinite(value)
    ? new Intl.NumberFormat("zh-CN", { maximumFractionDigits: precision }).format(value)
    : String(value),
  pct: (value, precision = 1) => `${Number(value).toFixed(precision)}%`,
};
