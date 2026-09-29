export const CAMPO_GRANDE_TIME_ZONE = "America/Campo_Grande";

const datePartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: CAMPO_GRANDE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

type CalendarParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const partsAt = (instant: Date): CalendarParts => {
  const parts = Object.fromEntries(
    datePartsFormatter
      .formatToParts(instant)
      .map(({ type, value }) => [type, Number(value)]),
  ) as Record<string, number>;
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
};

export const campoGrandeDateKey = (instant: Date): string => {
  const { year, month, day } = partsAt(instant);
  return `${year.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
};

const dateKeyParts = (dateKey: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const normalized = new Date(Date.UTC(year, month - 1, day))
    .toISOString()
    .slice(0, 10);
  return normalized === dateKey ? { year, month, day } : null;
};

const instantAtCampoGrandeTime = (
  dateKey: string,
  hour: number,
  minute = 0,
): Date | null => {
  const calendar = dateKeyParts(dateKey);
  if (!calendar || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  const targetAsUtc = Date.UTC(
    calendar.year,
    calendar.month - 1,
    calendar.day,
    hour,
    minute,
  );
  let guess = targetAsUtc;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const local = partsAt(new Date(guess));
    const representedAsUtc = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
      local.second,
    );
    const correction = targetAsUtc - representedAsUtc;
    guess += correction;
    if (correction === 0) break;
  }
  return new Date(guess);
};

export const campoGrandeDayStart = (instant: Date): Date => {
  const start = instantAtCampoGrandeTime(campoGrandeDateKey(instant), 0);
  if (!start) throw new Error("Data inválida para America/Campo_Grande.");
  return start;
};

export const campoGrandeDateStart = (dateKey: string): Date | null =>
  instantAtCampoGrandeTime(dateKey, 0);

export const campoGrandeDateAtHour = (
  instant: Date,
  hour: number,
): Date => {
  const result = instantAtCampoGrandeTime(campoGrandeDateKey(instant), hour);
  if (!result) throw new Error("Data ou horário inválido para America/Campo_Grande.");
  return result;
};

export const addCampoGrandeDays = (instant: Date, amount: number): Date => {
  const date = new Date(`${campoGrandeDateKey(instant)}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  const next = campoGrandeDateStart(date.toISOString().slice(0, 10));
  if (!next) throw new Error("Não foi possível avançar a data.");
  return next;
};

export const mondayInCampoGrande = (instant: Date): Date => {
  const dateKey = campoGrandeDateKey(instant);
  const weekday = new Date(`${dateKey}T00:00:00.000Z`).getUTCDay();
  return addCampoGrandeDays(campoGrandeDayStart(instant), -((weekday + 6) % 7));
};

export const campoGrandeCalendarDaysBetween = (
  start: Date,
  endInclusive: Date,
): number => {
  const startDay = Date.parse(`${campoGrandeDateKey(start)}T00:00:00.000Z`);
  const endDay = Date.parse(`${campoGrandeDateKey(endInclusive)}T00:00:00.000Z`);
  return Math.floor((endDay - startDay) / 86_400_000) + 1;
};