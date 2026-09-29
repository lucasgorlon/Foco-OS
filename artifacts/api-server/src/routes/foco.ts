import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreatePomodoroSessionBody,
  CreatePomodoroSessionResponse,
  GetCardsQueryParams,
  GetCardsResponse,
  GetConnectionResponse,
  GetDailySummaryResponse,
  GetMetricsQueryParams,
  GetMetricsResponse,
  GetPomodoroSessionsQueryParams,
  GetPomodoroSessionsResponse,
  GetSettingsResponse,
  GetWeeklySummaryQueryParams,
  GetWeeklySummaryResponse,
  MoveCardBody,
  MoveCardParams,
  MoveCardResponse,
  UpdateSettingsBody,
  UpdateSettingsResponse,
} from "@workspace/api-zod";
import { appSettingsTable, db } from "@workspace/db";
import {
  addCampoGrandeDays,
  campoGrandeDateStart,
  campoGrandeDayStart,
} from "../lib/campo-grande-time";
import {
  createPomodoroSession,
  filterCards,
  getCardSnapshot,
  getDailySummary,
  getMetrics,
  getSettingsResponse,
  getWeeklySummary,
  listPomodoroSessions,
  moveTask,
  updateSettings,
} from "../lib/foco-data";
import { AppError } from "../lib/errors";
import { getConnectionStatus } from "../lib/trello";

const router: IRouter = Router();

const queryString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const parseDateQuery = (value: unknown): Date | undefined => {
  const raw = queryString(value);
  if (!raw) return undefined;
  const dateOnly = /^(\d{4}-\d{2}-\d{2})(?:$|T)/.exec(raw)?.[1];
  if (dateOnly) return campoGrandeDateStart(dateOnly) ?? undefined;
  const instant = new Date(raw);
  return Number.isNaN(instant.getTime())
    ? undefined
    : campoGrandeDayStart(instant);
};

router.get("/connection", async (req, res): Promise<void> => {
  try {
    const response = GetConnectionResponse.parse(await getConnectionStatus());
    res.json(response);
  } catch (error) {
    req.log.error({ err: error }, "Failed to check Trello connection");
    res.status(502).json({
      error: "Não foi possível verificar a conexão com o Trello.",
    });
  }
});

router.get("/cards", async (req, res): Promise<void> => {
  const parsedQuery = GetCardsQueryParams.safeParse({
    includeCompleted:
      queryString(req.query.includeCompleted) === undefined
        ? undefined
        : queryString(req.query.includeCompleted) === "true",
    search: queryString(req.query.search),
    quadrant: queryString(req.query.quadrant),
  });
  if (!parsedQuery.success) {
    res.status(400).json({ error: parsedQuery.error.message });
    return;
  }

  try {
    const { cards } = await getCardSnapshot();
    res.json(
      GetCardsResponse.parse(
        filterCards(cards, {
          includeCompleted: parsedQuery.data.includeCompleted,
          search: parsedQuery.data.search,
          quadrant: parsedQuery.data.quadrant,
        }),
      ),
    );
  } catch (error) {
    req.log.error({ err: error }, "Failed to load Trello cards");
    res.status(502).json({
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível carregar os cards do Trello.",
    });
  }
});

router.post("/cards/:cardId/move", async (req, res): Promise<void> => {
  const params = MoveCardParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = MoveCardBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  try {
    const movedCard = await moveTask(params.data.cardId, body.data.listName);
    if (!movedCard) {
      res.status(404).json({ error: "Card não encontrado." });
      return;
    }
    res.json(MoveCardResponse.parse(movedCard));
  } catch (error) {
    req.log.error({ err: error, cardId: params.data.cardId }, "Failed to move Trello card");
    res.status(502).json({
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível mover o card no Trello.",
    });
  }
});

router.get("/dashboard/daily", async (req, res): Promise<void> => {
  try {
    res.json(GetDailySummaryResponse.parse(await getDailySummary()));
  } catch (error) {
    req.log.error({ err: error }, "Failed to build daily summary");
    res.status(502).json({
      error: "Não foi possível carregar o resumo do dia.",
    });
  }
});

router.get("/dashboard/weekly", async (req, res): Promise<void> => {
  const parsed = GetWeeklySummaryQueryParams.safeParse({
    weekOffset: queryString(req.query.weekOffset),
  });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    res.json(
      GetWeeklySummaryResponse.parse(
        await getWeeklySummary(parsed.data.weekOffset),
      ),
    );
  } catch (error) {
    req.log.error({ err: error }, "Failed to build weekly summary");
    res.status(502).json({
      error: "Não foi possível carregar a semana selecionada.",
    });
  }
});

router.get("/metrics", async (req, res): Promise<void> => {
  const startDate = parseDateQuery(req.query.startDate);
  const endDate = parseDateQuery(req.query.endDate);
  const parsed = GetMetricsQueryParams.safeParse({
    range: queryString(req.query.range),
    startDate: queryString(req.query.startDate) ? startDate : undefined,
    endDate: queryString(req.query.endDate) ? endDate : undefined,
  });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (
    (queryString(req.query.startDate) && !startDate) ||
    (queryString(req.query.endDate) && !endDate)
  ) {
    res.status(400).json({ error: "Informe datas válidas no formato AAAA-MM-DD." });
    return;
  }
  try {
    res.json(
      GetMetricsResponse.parse(
        await getMetrics(parsed.data.range, startDate, endDate),
      ),
    );
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    req.log.error({ err: error }, "Failed to build metrics");
    res.status(502).json({ error: "Não foi possível carregar as métricas." });
  }
});

router.get("/settings", async (req, res): Promise<void> => {
  try {
    res.json(GetSettingsResponse.parse(await getSettingsResponse()));
  } catch (error) {
    req.log.error({ err: error }, "Failed to read settings");
    res.status(500).json({ error: "Não foi possível carregar as configurações." });
  }
});

router.patch("/settings", async (req, res): Promise<void> => {
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const [current] = await db
      .select()
      .from(appSettingsTable)
      .where(eq(appSettingsTable.id, 1))
      .limit(1);
    const yellowLoadAt =
      parsed.data.yellowLoadAt ?? current?.yellowLoadAt ?? 4;
    const redLoadAt = parsed.data.redLoadAt ?? current?.redLoadAt ?? 7;
    if (redLoadAt <= yellowLoadAt) {
      res.status(400).json({
        error: "O limite vermelho precisa ser maior que o limite amarelo.",
      });
      return;
    }
    res.json(
      UpdateSettingsResponse.parse(await updateSettings(parsed.data)),
    );
  } catch (error) {
    req.log.error({ err: error }, "Failed to update settings");
    res.status(500).json({ error: "Não foi possível salvar as configurações." });
  }
});

router.get("/pomodoro/sessions", async (req, res): Promise<void> => {
  const rawStart = queryString(req.query.startDate);
  const rawEnd = queryString(req.query.endDate);
  const startDate = parseDateQuery(rawStart);
  const endDate = parseDateQuery(rawEnd);
  const parsed = GetPomodoroSessionsQueryParams.safeParse({
    startDate: rawStart ? startDate : undefined,
    endDate: rawEnd ? endDate : undefined,
  });
  if (!parsed.success || (rawStart && !startDate) || (rawEnd && !endDate)) {
    res.status(400).json({
      error: parsed.success
        ? "Informe datas válidas no formato AAAA-MM-DD."
        : parsed.error.message,
    });
    return;
  }
  if (startDate && endDate && endDate < startDate) {
    res.status(400).json({
      error: "A data final precisa ser igual ou posterior à data inicial.",
    });
    return;
  }

  try {
    const endExclusive = endDate
      ? addCampoGrandeDays(endDate, 1)
      : undefined;
    res.json(
      GetPomodoroSessionsResponse.parse(
        await listPomodoroSessions(startDate, endExclusive),
      ),
    );
  } catch (error) {
    req.log.error({ err: error }, "Failed to list focus sessions");
    res.status(500).json({ error: "Não foi possível carregar as sessões de foco." });
  }
});

router.post("/pomodoro/sessions", async (req, res): Promise<void> => {
  const parsed = CreatePomodoroSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (
    parsed.data.endedAt &&
    parsed.data.endedAt < parsed.data.startedAt
  ) {
    res.status(400).json({
      error: "O horário de término precisa ser posterior ao início.",
    });
    return;
  }

  try {
    const created = await createPomodoroSession(parsed.data);
    res.status(201).json(CreatePomodoroSessionResponse.parse(created));
  } catch (error) {
    req.log.error({ err: error }, "Failed to save focus session");
    res.status(500).json({ error: "Não foi possível salvar a sessão de foco." });
  }
});

export default router;