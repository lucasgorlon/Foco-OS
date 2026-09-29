import { and, desc, eq, gte, lt } from "drizzle-orm";
import {
  CreatePomodoroSessionBody,
  GetCardsResponseItem,
} from "@workspace/api-zod";
import {
  appSettingsTable,
  db,
  pomodoroSessionsTable,
} from "@workspace/db";
import {
  addCampoGrandeDays,
  campoGrandeCalendarDaysBetween,
  campoGrandeDateKey,
  campoGrandeDayStart,
  mondayInCampoGrande,
} from "./campo-grande-time";
import { AppError } from "./errors";
import {
  getBoardSnapshot,
  getConnectionStatus,
  isCompleted,
  isInbox,
  isQuadrant,
  type TaskCard,
} from "./trello";

type PomodoroInput = (typeof CreatePomodoroSessionBody)["_output"];
type Card = (typeof GetCardsResponseItem)["_output"];

const QUADRANTS = [
  "Q1 - Fazer agora",
  "Q2 - Agendar",
  "Q3 - Delegar",
  "Q4 - Eliminar",
] as const;
const AREAS = ["Trabalho", "Faculdade", "Pessoal", "Saúde"] as const;

const round = (value: number, decimals = 2): number =>
  Number(value.toFixed(decimals));

export const readSettingsRecord = async () => {
  const [existing] = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.id, 1))
    .limit(1);
  if (existing) return existing;

  await db.insert(appSettingsTable).values({ id: 1 }).onConflictDoNothing();
  const [created] = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.id, 1))
    .limit(1);
  if (!created) throw new Error("Não foi possível carregar as configurações.");
  return created;
};

export const getSettingsResponse = async () => {
  const [settings, connection] = await Promise.all([
    readSettingsRecord(),
    getConnectionStatus(),
  ]);
  return {
    focusMinutes: settings.focusMinutes,
    shortBreakMinutes: settings.shortBreakMinutes,
    longBreakMinutes: settings.longBreakMinutes,
    longBreakEvery: settings.longBreakEvery,
    dailyPomodoroLimit: settings.dailyPomodoroLimit,
    yellowLoadAt: settings.yellowLoadAt,
    redLoadAt: settings.redLoadAt,
    theme: settings.theme === "light" ? "light" : "dark",
    connection,
  };
};

export const updateSettings = async (
  settingsUpdate: Partial<{
    focusMinutes: number;
    shortBreakMinutes: number;
    longBreakMinutes: number;
    longBreakEvery: number;
    dailyPomodoroLimit: number;
    yellowLoadAt: number;
    redLoadAt: number;
    theme: "dark" | "light";
  }>,
) => {
  await readSettingsRecord();
  if (Object.keys(settingsUpdate).length > 0) {
    await db
      .update(appSettingsTable)
      .set(settingsUpdate)
      .where(eq(appSettingsTable.id, 1));
  }
  return getSettingsResponse();
};

const getSessions = async (start?: Date, endExclusive?: Date) => {
  const conditions = [];
  if (start) conditions.push(gte(pomodoroSessionsTable.startedAt, start));
  if (endExclusive)
    conditions.push(lt(pomodoroSessionsTable.startedAt, endExclusive));

  return conditions.length > 0
    ? db
        .select()
        .from(pomodoroSessionsTable)
        .where(and(...conditions))
        .orderBy(desc(pomodoroSessionsTable.startedAt))
    : db
        .select()
        .from(pomodoroSessionsTable)
        .orderBy(desc(pomodoroSessionsTable.startedAt));
};

const cardTitleMap = async (): Promise<Map<string, string>> => {
  try {
    const { cards } = await getBoardSnapshot();
    return new Map(cards.map((card) => [card.id, card.title]));
  } catch {
    return new Map();
  }
};

const mapSession = (
  session: Awaited<ReturnType<typeof getSessions>>[number],
  titles: Map<string, string>,
) => ({
  id: String(session.id),
  cardId: session.cardId,
  cardTitle: session.cardId ? (titles.get(session.cardId) ?? null) : null,
  durationMinutes: session.durationMinutes,
  startedAt: session.startedAt,
  endedAt: session.endedAt,
});

export const listPomodoroSessions = async (
  start?: Date,
  endExclusive?: Date,
) => {
  const [sessions, titles] = await Promise.all([
    getSessions(start, endExclusive),
    cardTitleMap(),
  ]);
  return sessions.map((session) => mapSession(session, titles));
};

export const createPomodoroSession = async (input: PomodoroInput) => {
  const startedAt = input.startedAt;
  const endedAt =
    input.endedAt ??
    new Date(startedAt.getTime() + input.durationMinutes * 60_000);
  const [session] = await db
    .insert(pomodoroSessionsTable)
    .values({
      cardId: input.cardId ?? null,
      durationMinutes: input.durationMinutes,
      startedAt,
      endedAt,
    })
    .returning();
  if (!session) throw new Error("Não foi possível salvar a sessão de foco.");
  const titles = await cardTitleMap();
  return mapSession(session, titles);
};

const getWorkload = async (
  cards: TaskCard[],
  pomodorosCount: number,
): Promise<{
  level: "green" | "yellow" | "red";
  q1Count: number;
  overdueCount: number;
  pomodorosCount: number;
  message: string | null;
}> => {
  const now = new Date();
  const todayStart = campoGrandeDayStart(now);
  const active = cards.filter((card) => !isCompleted(card));
  const q1Count = active.filter((card) =>
    card.listName.toLowerCase().startsWith("q1"),
  ).length;
  const overdueCount = active.filter(
    (card) => card.due && card.due < todayStart,
  ).length;
  const load = q1Count + overdueCount + pomodorosCount;
  const settings = await readSettingsRecord();
  const level: "green" | "yellow" | "red" =
    load >= settings.redLoadAt
      ? "red"
      : load >= settings.yellowLoadAt
        ? "yellow"
        : "green";
  const message =
    level === "red"
      ? "O dia está cheio. Faça uma pausa e renegocie o que puder."
      : level === "yellow"
        ? "Há bastante coisa em andamento. Considere delegar ou pausar um pouco."
        : null;
  return { level, q1Count, overdueCount, pomodorosCount, message };
};

const buildPriorities = (cards: TaskCard[], today: Date) => {
  const todayKey = campoGrandeDateKey(today);
  return cards
    .filter((card) => {
      if (isCompleted(card)) return false;
      const isQ1 = card.listName.toLowerCase().startsWith("q1");
      const dueToday = card.due && campoGrandeDateKey(card.due) === todayKey;
      return isQ1 || dueToday;
    })
    .sort((a, b) => {
      const aQ1 = a.listName.toLowerCase().startsWith("q1") ? 0 : 1;
      const bQ1 = b.listName.toLowerCase().startsWith("q1") ? 0 : 1;
      if (aQ1 !== bQ1) return aQ1 - bQ1;
      return (a.due?.getTime() ?? Number.MAX_SAFE_INTEGER) -
        (b.due?.getTime() ?? Number.MAX_SAFE_INTEGER);
    })
    .slice(0, 5);
};

export const getDailySummary = async () => {
  const now = new Date();
  const todayStart = campoGrandeDayStart(now);
  const tomorrowStart = addCampoGrandeDays(todayStart, 1);
  const [{ cards }, sessions] = await Promise.all([
    getBoardSnapshot(),
    getSessions(todayStart, tomorrowStart),
  ]);
  const active = cards.filter((card) => !isCompleted(card));
  const overdue = active
    .filter((card) => card.due && card.due < todayStart)
    .sort((a, b) => (a.due?.getTime() ?? 0) - (b.due?.getTime() ?? 0));
  const completedToday = cards.filter(
    (card) =>
      isCompleted(card) &&
      card.completedAt &&
      card.completedAt >= todayStart &&
      card.completedAt < tomorrowStart,
  ).length;
  const pomodorosToday = sessions.length;

  return {
    date: todayStart,
    priorities: buildPriorities(cards, todayStart),
    overdue,
    inboxCount: active.filter(isInbox).length,
    pomodorosToday,
    completedToday,
    workload: await getWorkload(cards, pomodorosToday),
  };
};

export const getWeeklySummary = async (weekOffset: number) => {
  const start = addCampoGrandeDays(
    mondayInCampoGrande(new Date()),
    weekOffset * 7,
  );
  const endExclusive = addCampoGrandeDays(start, 7);
  const { cards } = await getBoardSnapshot();
  const active = cards.filter((card) => !isCompleted(card));
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = addCampoGrandeDays(start, index);
    const key = campoGrandeDateKey(day);
    return {
      date: key,
      cards: active.filter(
        (card) => card.due && campoGrandeDateKey(card.due) === key,
      ),
    };
  });
  return {
    weekStart: campoGrandeDateKey(start),
    weekEnd: campoGrandeDateKey(addCampoGrandeDays(endExclusive, -1)),
    days,
    withoutDate: active.filter((card) => !card.due),
  };
};

export const getMetrics = async (
  range: "7d" | "30d" | "custom",
  customStart?: Date,
  customEnd?: Date,
) => {
  const today = campoGrandeDayStart(new Date());
  let periodEnd = today;
  let start: Date;
  if (range === "custom") {
    if (!customStart || !customEnd) {
      throw new AppError(
        400,
        "Informe a data inicial e a data final para o período personalizado.",
      );
    }
    start = campoGrandeDayStart(customStart);
    const inclusiveEnd = campoGrandeDayStart(customEnd);
    if (inclusiveEnd < start) {
      throw new AppError(
        400,
        "A data final precisa ser igual ou posterior à data inicial.",
      );
    }
    const duration = campoGrandeCalendarDaysBetween(start, inclusiveEnd);
    if (duration > 366) {
      throw new AppError(400, "O período máximo permitido é de 366 dias.");
    }
    periodEnd = inclusiveEnd;
  } else {
    start = addCampoGrandeDays(today, range === "7d" ? -6 : -29);
  }
  const endExclusive = addCampoGrandeDays(periodEnd, 1);

  const [snapshot, sessions] = await Promise.all([
    getBoardSnapshot(),
    getSessions(start, endExclusive),
  ]);
  const { cards } = snapshot;
  const openCards = cards.filter((card) => !isCompleted(card));
  const completed = cards.filter(
    (card) =>
      isCompleted(card) &&
      card.completedAt &&
      card.completedAt >= start &&
      card.completedAt < endExclusive,
  );
  const dayCount = campoGrandeCalendarDaysBetween(start, periodEnd);
  const dateKeys = Array.from({ length: dayCount }, (_, index) =>
    campoGrandeDateKey(addCampoGrandeDays(start, index)),
  );
  const completedCountByDate = new Map<string, number>();
  for (const card of completed) {
    if (!card.completedAt) continue;
    const key = campoGrandeDateKey(card.completedAt);
    completedCountByDate.set(key, (completedCountByDate.get(key) ?? 0) + 1);
  }
  const sessionsByDate = new Map<string, typeof sessions>();
  for (const session of sessions) {
    const key = campoGrandeDateKey(session.startedAt);
    sessionsByDate.set(key, [...(sessionsByDate.get(key) ?? []), session]);
  }

  const openByQuadrant = QUADRANTS.map((quadrant) => ({
    quadrant,
    count: openCards.filter((card) => card.listName === quadrant).length,
  }));
  const totalFocusMinutes = sessions.reduce(
    (sum, session) => sum + session.durationMinutes,
    0,
  );
  const tasksInPeriod = completed.length + openCards.length;
  const areaMinutes = new Map<string, number>(AREAS.map((area) => [area, 0]));
  const cardById = new Map(cards.map((card) => [card.id, card]));
  for (const session of sessions) {
    const linkedCard = session.cardId ? cardById.get(session.cardId) : undefined;
    const labelNames = linkedCard?.labels.map((label) => label.name) ?? [];
    for (const area of AREAS) {
      if (labelNames.includes(area)) {
        areaMinutes.set(
          area,
          (areaMinutes.get(area) ?? 0) + session.durationMinutes,
        );
      }
    }
  }

  return {
    from: start,
    to: periodEnd,
    completionRate:
      tasksInPeriod === 0 ? 0 : round((completed.length / tasksInPeriod) * 100),
    averageDailyFocusHours:
      dayCount === 0 ? 0 : round(totalFocusMinutes / dayCount / 60),
    q2Percentage:
      openCards.length === 0
        ? 0
        : round(
            (openCards.filter((card) => card.listName === "Q2 - Agendar").length /
              openCards.length) *
              100,
          ),
    overdueCount: openCards.filter(
      (card) => card.due && card.due < campoGrandeDayStart(new Date()),
    ).length,
    completedByDay: dateKeys.map((date) => ({
      date,
      count: completedCountByDate.get(date) ?? 0,
    })),
    focusByDay: dateKeys.map((date) => {
      const daySessions = sessionsByDate.get(date) ?? [];
      return {
        date,
        pomodoros: daySessions.length,
        focusHours: round(
          daySessions.reduce(
            (sum, session) => sum + session.durationMinutes,
            0,
          ) / 60,
        ),
      };
    }),
    openByQuadrant,
    focusByArea: AREAS.map((area) => ({
      area,
      focusHours: round((areaMinutes.get(area) ?? 0) / 60),
    })),
  };
};

const sessionCount = async (start: Date, endExclusive: Date) =>
  (await getSessions(start, endExclusive)).length;

export const getAutomationDailySummary = async () => {
  const now = new Date();
  const todayStart = campoGrandeDayStart(now);
  const yesterdayStart = addCampoGrandeDays(todayStart, -1);
  const [{ cards }, pomodorosYesterday] = await Promise.all([
    getBoardSnapshot(),
    sessionCount(yesterdayStart, todayStart),
  ]);
  const completedYesterday = cards.filter(
    (card) =>
      isCompleted(card) &&
      card.completedAt &&
      card.completedAt >= yesterdayStart &&
      card.completedAt < todayStart,
  ).length;
  const active = cards.filter((card) => !isCompleted(card));
  const overdue = active.filter((card) => card.due && card.due < todayStart);
  return {
    date: todayStart,
    priorities: buildPriorities(cards, todayStart),
    overdue,
    inboxCount: active.filter(isInbox).length,
    pomodorosYesterday,
    completedYesterday,
    workload: await getWorkload(
      cards,
      await sessionCount(todayStart, addCampoGrandeDays(todayStart, 1)),
    ),
  };
};

export const getAutomationWeeklySummary = async () => {
  const thisWeekStart = mondayInCampoGrande(new Date());
  const thisWeekEnd = addCampoGrandeDays(thisWeekStart, 7);
  const nextWeekEnd = addCampoGrandeDays(thisWeekEnd, 7);
  const [{ cards }, sessions] = await Promise.all([
    getBoardSnapshot(),
    getSessions(thisWeekStart, thisWeekEnd),
  ]);
  const completedThisWeek = cards.filter(
    (card) =>
      isCompleted(card) &&
      card.completedAt &&
      card.completedAt >= thisWeekStart &&
      card.completedAt < thisWeekEnd,
  ).length;
  const openCards = cards.filter((card) => !isCompleted(card));
  const byQuadrant = QUADRANTS.map((quadrant) => ({
    quadrant,
    count: openCards.filter((card) => card.listName === quadrant).length,
  }));
  const labelCounts = new Map<string, number>();
  for (const card of openCards) {
    for (const label of card.labels) {
      labelCounts.set(label.name, (labelCounts.get(label.name) ?? 0) + 1);
    }
  }
  const nextWeekCards = openCards.filter(
    (card) =>
      card.due &&
      card.due >= thisWeekEnd &&
      card.due < nextWeekEnd,
  );
  return {
    completedThisWeek,
    focusHours: round(
      sessions.reduce((sum, session) => sum + session.durationMinutes, 0) / 60,
    ),
    byQuadrant,
    byLabel: [...labelCounts.entries()].map(([label, count]) => ({
      label,
      count,
    })),
    nextWeekCards,
  };
};

export const filterCards = (
  cards: Card[],
  options: {
    includeCompleted: boolean;
    search?: string;
    quadrant?: string;
  },
) => {
  const search = options.search?.trim().toLocaleLowerCase("pt-BR");
  return cards.filter((card) => {
    if (!options.includeCompleted && isCompleted(card)) return false;
    if (options.quadrant && card.listName !== options.quadrant) return false;
    if (
      search &&
      !`${card.title} ${card.description} ${card.labels
        .map((label) => label.name)
        .join(" ")}`
        .toLocaleLowerCase("pt-BR")
        .includes(search)
    ) {
      return false;
    }
    return true;
  });
};

export const moveTask = async (cardId: string, listName: string) => {
  const { moveBoardCard } = await import("./trello");
  return moveBoardCard(cardId, listName);
};

export const getCardSnapshot = async () => getBoardSnapshot();

export const taskUsesQuadrant = (card: TaskCard): boolean => isQuadrant(card);