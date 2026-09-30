import type { NextFunction, Request, Response } from "express";
import {
  APP_SESSION_COOKIE,
  isValidAppSessionToken,
} from "../lib/app-session";

export const hasValidAppSession = (req: Request): boolean => {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return false;
  return isValidAppSessionToken(
    req.cookies?.[APP_SESSION_COOKIE],
    secret,
  );
};

export const requireAppSession = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  res.setHeader("Cache-Control", "no-store");
  if (!process.env.SESSION_SECRET) {
    res.status(503).json({
      error: "A autenticação de sessão não está configurada.",
    });
    return;
  }

  if (!hasValidAppSession(req)) {
    res.status(401).json({ error: "Autenticação necessária." });
    return;
  }

  next();
};