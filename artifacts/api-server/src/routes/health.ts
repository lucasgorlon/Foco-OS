import { Router, type IRouter } from "express";
import {
  GetAutomationHealthResponse,
  HealthCheckResponse,
} from "@workspace/api-zod";
import { requireAutomationApiKey } from "../middlewares/api-key";
import { getConnectionStatus } from "../lib/trello";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get(
  "/health",
  requireAutomationApiKey,
  async (req, res): Promise<void> => {
    try {
      res.json(
        GetAutomationHealthResponse.parse(await getConnectionStatus()),
      );
    } catch (error) {
      req.log.error({ err: error }, "Failed to check API health");
      res.status(502).json({
        error: "Não foi possível verificar o status do Trello.",
      });
    }
  },
);

export default router;
