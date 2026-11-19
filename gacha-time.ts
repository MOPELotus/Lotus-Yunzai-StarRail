const firstStarRailBanner = Date.UTC(2023, 3, 25, 22);

export const officialStarRailGachaSource = "mihoyo_star_rail_gacha_miniapp";

/** Official miniapp IDs begin with the draw's Unix time in seconds. */
export function officialStarRailGachaTime(id: unknown): number {
  if (typeof id !== "string" || !/^\d{18,20}$/u.test(id)) return NaN;
  const time = Number(id.slice(0, 10)) * 1000;
  return time >= firstStarRailBanner ? time : NaN;
}
