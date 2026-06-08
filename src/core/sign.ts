import axios from "axios";
import crypto from "node:crypto";
import type { AppConfig } from "./config.js";
import { logger } from "../utils/logger.js";
import { getTimestamp, randomString } from "../utils/crypto.js";

export interface SignParams {
  api: string;
  v?: string;
  data: Record<string, unknown>;
  session: {
    token: string;
    appKey: string;
    deviceId: string;
  };
}

export interface SignResult {
  "x-sign": string;
  "x-mini-wua": string;
  "x-umt": string;
  "x-sgext": string;
  "x-features": string;
  "x-app-ver": string;
}

export async function getSign(params: SignParams, config: AppConfig): Promise<SignResult> {
  const timestamp = getTimestamp();
  const nonce = randomString(16);

  const payload = {
    api: params.api,
    v: params.v || "1.0",
    data: JSON.stringify(params.data),
    token: params.session.token,
    appKey: params.session.appKey,
    deviceId: params.session.deviceId,
    timestamp,
    nonce,
  };

  try {
    const response = await axios.post(`${config.xSignServiceUrl}/sign`, payload, {
      timeout: 10000,
      headers: { "Content-Type": "application/json" },
    });

    if (response.data && response.data["x-sign"]) {
      return response.data as SignResult;
    }

    throw new Error("Invalid sign response");
  } catch (error) {
    logger.error("Failed to get x-sign", {
      module: "sign",
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export function buildMtopSign(data: string, token: string, timestamp: number, appKey: string): string {
  const raw = `${token}&${timestamp}&${appKey}&${data}`;
  return crypto.createHash("md5").update(raw).digest("hex");
}
