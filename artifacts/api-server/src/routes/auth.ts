import { createHash, timingSafeEqual } from "node:crypto";
import { Router, type IRouter, type Request } from "express";
import {
  GetAppSessionResponse,
  LoginWithPasswordBody,
  LoginWithPasswordResponse,
} from "@workspace/api-zod";
import {
  APP_SESSION_COOKIE,
  APP_SESSION_TTL_SECONDS,
  createAppSessionToken,
} from "../lib/app-session";
import {
  hasValidAppSession,
  requireAppSession,
} from "../middlewares/require-app-session";

const router: IRouter = Router();

router.use("/auth", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

const cookieOptions = (secure: boolean) => ({
  httpOnly: true,
  maxAge: APP_SESSION_TTL_SECONDS * 1000,
  path: "/",
  sameSite: "lax" as const,
  secure,
});

const requestUsesHttps = (req: Request) =>
  process.env.NODE_ENV === "production" ||
  req.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https";

router.get("/auth/session", (req, res): void => {
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
  res.json(GetAppSessionResponse.parse({ authenticated: true }));
});

router.post("/auth/login", (req, res): void => {
  const password = process.env.APP_PASSWORD;
  const sessionSecret = process.env.SESSION_SECRET;
  if (!password || !sessionSecret) {
    res.status(503).json({
      error: "A autenticação não está configurada corretamente.",
    });
    return;
  }

  const parsed = LoginWithPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Informe uma senha válida." });
    return;
  }

  const providedDigest = createHash("sha256")
    .update(parsed.data.password)
    .digest();
  const expectedDigest = createHash("sha256").update(password).digest();
  if (!timingSafeEqual(providedDigest, expectedDigest)) {
    res.status(401).json({ error: "Senha incorreta." });
    return;
  }

  const secure = requestUsesHttps(req);
  res.cookie(
    APP_SESSION_COOKIE,
    createAppSessionToken(sessionSecret),
    cookieOptions(secure),
  );
  res.json(LoginWithPasswordResponse.parse({ authenticated: true }));
});

router.post("/auth/logout", requireAppSession, (req, res): void => {
  const secure = requestUsesHttps(req);
  res.clearCookie(APP_SESSION_COOKIE, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure,
  });
  res.sendStatus(204);
});

export default router;