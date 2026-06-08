import type { AppConfig } from "./config.js";
import { logger } from "../utils/logger.js";

export interface AuthSession {
  cookie: string;
  userId: string;
  token: string;
  deviceId: string;
  appKey: string;
  expiresAt: number;
  valid: boolean;
}

export function createSession(config: AppConfig): AuthSession {
  return {
    cookie: config.cookie,
    userId: config.userId,
    token: config.token,
    deviceId: config.deviceId,
    appKey: config.appKey,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    valid: true,
  };
}

export function isSessionValid(session: AuthSession): boolean {
  if (!session.valid) return false;
  if (Date.now() >= session.expiresAt) {
    logger.warn("Session expired", { module: "auth" });
    return false;
  }
  if (!session.cookie || !session.token) {
    logger.warn("Session missing cookie or token", { module: "auth" });
    return false;
  }
  return true;
}

export function refreshSession(session: AuthSession, newCookie: string, newToken: string): AuthSession {
  logger.info("Refreshing auth session", { module: "auth" });
  return {
    ...session,
    cookie: newCookie,
    token: newToken,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    valid: true,
  };
}
