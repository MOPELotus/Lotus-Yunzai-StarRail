import type { StarRailPowerRecovery } from "@lotus-yunzai/hoyo-client";

const minutesPerDay = 1_440;
const msPerMinute = 60_000;
const msPerDay = minutesPerDay * msPerMinute;
const chinaOffset = 8 * 60 * msPerMinute;

function chinaCivilMinute(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?(Z|[+-]\d{2}:\d{2})?$/u.exec(value);
  if (!match) return;
  const [, year, month, day, hour, minute, second = "00", zone] = match;
  const civil = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)));
  if (!Number.isFinite(civil.valueOf()) ||
      civil.toISOString().slice(0, 19) !== `${year}-${month}-${day}T${hour}:${minute}:${second}`) return;
  const time = zone ? Date.parse(`${year}-${month}-${day}T${hour}:${minute}:${second}${zone}`) + chinaOffset : civil.valueOf();
  if (Number.isFinite(time)) return Math.floor(time / msPerMinute);
}
const dayName = (day: number) => new Date(day * msPerDay).toISOString().slice(0, 10);
const hours = (minutes: number) => (minutes / 60).toFixed(1);
type Interval = { start: number; end: number };

function timeline(day: number, samples: readonly number[]) {
  const startOfDay = day * minutesPerDay, endOfDay = startOfDay + minutesPerDay;
  const intervals: Interval[] = [];
  for (const sample of samples) {
    const start = Math.max(sample - 6, startOfDay) - startOfDay;
    const end = Math.min(sample, endOfDay) - startOfDay;
    if (end <= start) continue;
    const last = intervals.at(-1);
    if (last && last.end >= start) last.end = Math.max(end, last.end);
    else intervals.push({ start, end });
  }
  const blocks = [];
  let cursor = 0;
  for (const { start, end } of intervals) {
    if (start > cursor) blocks.push({ width: (start - cursor) * 100 / minutesPerDay, online: false });
    blocks.push({ width: (end - start) * 100 / minutesPerDay, online: true });
    cursor = end;
  }
  if (cursor < minutesPerDay) blocks.push({ width: (minutesPerDay - cursor) * 100 / minutesPerDay, online: false });
  return blocks;
}

const heatColors = ["#eef0ec", "#c2d9e7", "#98baca", "#608fba", "#46678e", "#395273", "#293951"];
export function starRailOnlineReport(recoveries: readonly StarRailPowerRecovery[], now = new Date()) {
  const todayMinute = Math.floor((now.valueOf() + chinaOffset) / msPerMinute);
  const today = Math.floor(todayMinute / minutesPerDay);
  const samples = new Set<number>();
  let oldest = today;
  for (const { time, count } of recoveries) {
    const minute = chinaCivilMinute(time);
    if (minute === undefined || minute > todayMinute) throw new Error("官方星铁开拓力流水的恢复日期无效。");
    oldest = Math.min(oldest, Math.floor(minute / minutesPerDay));
    if (count === 1) samples.add(minute);
  }
  if (!recoveries.length) return;
  const ordered = [...samples].sort((a, b) => a - b);
  const daily = new Map<number, number>();
  for (const sample of ordered) {
    const day = Math.floor(sample / minutesPerDay);
    daily.set(day, (daily.get(day) ?? 0) + 6);
  }
  const days = Array.from({ length: 7 }, (_, index) => today - 6 + index);
  const recent = days.filter(day => day >= oldest).map(day => ({ date: dayName(day), minutes: daily.get(day) ?? 0 }));
  const scale = Math.max(6, ...recent.map(day => day.minutes));
  const bars = recent.map(({ date, minutes }) => ({ date, shortDate: date.slice(5), hours: hours(minutes), height: minutes * 100 / scale }));
  const details = days.slice().reverse().map(day => ({
    date: dayName(day), blocks: timeline(day, ordered), covered: day >= oldest,
  }));
  const year = Number(dayName(today).slice(0, 4));
  const yearStart = Math.floor(Date.UTC(year, 0, 1) / msPerDay);
  const yearEnd = Math.floor(Date.UTC(year + 1, 0, 1) / msPerDay);
  const weekStart = yearStart - new Date(yearStart * msPerDay).getUTCDay();
  const cells = [], months = [];
  for (let day = yearStart; day < yearEnd; day++) {
    const date = new Date(day * msPerDay);
    const covered = day >= oldest && day <= today;
    const minutes = daily.get(day) ?? 0;
    const x = Math.floor((day - weekStart) / 7) * 12 + 30, y = date.getUTCDay() * 17 + 43;
    if (date.getUTCDate() === 1) months.push({ x, label: `${date.getUTCMonth() + 1}月` });
    cells.push({ x, y, color: covered ? heatColors[Math.min(heatColors.length - 1, Math.ceil(minutes / 240))] : "#faf5e6",
      title: `${dayName(day)} ${covered ? hours(minutes) + " 小时" : "无覆盖记录"}` });
  }
  return { bars, details, year, cells, months, sampleCount: ordered.length, since: dayName(oldest) };
}
