import { createHmac, timingSafeEqual } from "node:crypto";

export const APP_SESSION_COOKIE = "foco_os_session";
export const APP_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

type AppSessionPayload = {
  issuedAt: number;
  expiresAt: number;
};

const signatureFor = (payload: string, secret: string): Buffer =>
  createHmac("sha256", secret).update(payload).digest();

export const createAppSessionToken = (
  secret: string,
  now = Date.now(),
): string => {
  const issuedAt = Math.floor(now / 1000);
  const payload: AppSessionPayload = {
    issuedAt,
    expiresAt: issuedAt + APP_SESSION_TTL_SECONDS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );
  const signature = signatureFor(encodedPayload, secret).toString("base64url");
  return `${encodedPayload}.${signature}`;
};

export const isValidAppSessionToken = (
  token: unknown,
  secret: string,
  now = Date.now(),
): boolean => {
  if (typeof token !== "string" || token.length > 512) return false;
  const [encodedPayload, encodedSignature, extra] = token.split(".");
  if (!encodedPayload || !encodedSignature || extra !== undefined) return false;

  const suppliedSignature = Buffer.from(encodedSignature, "base64url");
  const expectedSignature = signatureFor(encodedPayload, secret);
  if (
    suppliedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(suppliedSignature, expectedSignature)
  ) {
    return false;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as Partial<AppSessionPayload>;
    const nowSeconds = Math.floor(now / 1000);
    if (
      !Number.isSafeInteger(payload.issuedAt) ||
      !Number.isSafeInteger(payload.expiresAt) ||
      payload.issuedAt === undefined ||
      payload.expiresAt === undefined
    ) {
      return false;
    }

    const duration = payload.expiresAt - payload.issuedAt;
    return (
      payload.issuedAt <= nowSeconds + 60 &&
      payload.expiresAt > nowSeconds &&
      duration > 0 &&
      duration <= APP_SESSION_TTL_SECONDS
    );
  } catch {
    return false;
  }
};