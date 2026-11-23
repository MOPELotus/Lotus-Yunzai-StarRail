export function normalizeStarRailRegion(region: unknown): string | undefined {
  if (typeof region !== "string") return;
  return region === "prod_official_euro" ? "prod_official_eur" : region;
}
