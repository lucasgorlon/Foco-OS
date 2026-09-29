import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export const requireAutomationApiKey = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const expected = process.env.POS_API_KEY;
  if (!expected) {
    res.status(503).json({
      error:
        "A API de automações está desativada. Configure POS_API_KEY nos Secrets.",
    });
    return;
  }

  const provided = req.get("x-api-key") ?? "";
  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided);
  const valid =
    expectedBytes.length === providedBytes.length &&
    timingSafeEqual(expectedBytes, providedBytes);

  if (!valid) {
    res.status(401).json({ error: "Chave de API ausente ou inválida." });
    return;
  }
  next();
};