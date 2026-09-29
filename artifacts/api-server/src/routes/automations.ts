import { Router, type IRouter } from "express";
import {
  CreateExternalPomodoroBody,
  CreateExternalPomodoroResponse,
  GetAutomationDailySummaryResponse,
  GetAutomationWeeklySummaryResponse,
} from "@workspace/api-zod";
import { requireAutomationApiKey } from "../middlewares/api-key";
import {
  createPomodoroSession,
  getAutomationDailySummary,
  getAutomationWeeklySummary,
} from "../lib/foco-data";

const router: IRouter = Router();

router.get(
  "/resumo-diario",
  requireAutomationApiKey,
  async (req, res): Promise<void> => {
    try {
      res.json(
        GetAutomationDailySummaryResponse.parse(
          await getAutomationDailySummary(),
        ),
      );
    } catch (error) {
      req.log.error({ err: error }, "Failed to build automation daily summary");
      res.status(502).json({
        error: "Não foi possível carregar o resumo diário para automação.",
      });
    }
  },
);

router.get(
  "/resumo-semanal",
  requireAutomationApiKey,
  async (req, res): Promise<void> => {
    try {
      res.json(
        GetAutomationWeeklySummaryResponse.parse(
          await getAutomationWeeklySummary(),
        ),
      );
    } catch (error) {
      req.log.error({ err: error }, "Failed to build automation weekly summary");
      res.status(502).json({
        error: "Não foi possível carregar o resumo semanal para automação.",
      });
    }
  },
);

router.post(
  "/pomodoro",
  requireAutomationApiKey,
  async (req, res): Promise<void> => {
    const body = req.body as Record<string, unknown>;
    const parsed = CreateExternalPomodoroBody.safeParse({
      cardId: body.cardId ?? body.card_id ?? null,
      durationMinutes: body.durationMinutes ?? body.duration,
      startedAt: body.startedAt ?? body.started_at ?? body.start,
      endedAt: body.endedAt ?? body.ended_at,
    });
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
      const session = await createPomodoroSession(parsed.data);
      res.status(201).json(
        CreateExternalPomodoroResponse.parse(session),
      );
    } catch (error) {
      req.log.error({ err: error }, "Failed to register external Pomodoro");
      res.status(500).json({
        error: "Não foi possível registrar a sessão de Pomodoro.",
      });
    }
  },
);

export default router;