import { config as dotenvConfig } from "dotenv";
import path from "node:path";
import fs from "node:fs";

dotenvConfig({ path: path.resolve(".env") });

export interface AutoReplyRule {
  keywords: string[];
  reply: string;
}

export interface AppConfig {
  cookie: string;
  userId: string;
  deviceId: string;
  appKey: string;
  token: string;
  xSignServiceUrl: string;
  apiBaseUrl: string;
  wsUrl: string;
  autoReplyEnabled: boolean;
  autoReplyRules: AutoReplyRule[];
  defaultReply: string;
  autoPolishEnabled: boolean;
  polishIntervalHours: number;
  priceMonitorEnabled: boolean;
  priceCheckIntervalMinutes: number;
  autoListEnabled: boolean;
  autoDeliverEnabled: boolean;
  deliverRules: DeliverRule[];
  dataScrapeEnabled: boolean;
  scrapeIntervalHours: number;
  logLevel: string;
  dataDir: string;
}

export interface DeliverRule {
  itemId: string;
  keywords: string[];
  deliverContent: string;
}

const DEFAULT_CONFIG: AppConfig = {
  cookie: "",
  userId: "",
  deviceId: "",
  appKey: "34839810",
  token: "",
  xSignServiceUrl: "http://127.0.0.1:8080",
  apiBaseUrl: "https://h5api.m.goofish.com",
  wsUrl: "wss://wss-goofish.dingtalk.com:443",
  autoReplyEnabled: true,
  autoReplyRules: [],
  defaultReply: "亲，稍等一下，我会尽快回复您~",
  autoPolishEnabled: true,
  polishIntervalHours: 8,
  priceMonitorEnabled: false,
  priceCheckIntervalMinutes: 30,
  autoListEnabled: false,
  autoDeliverEnabled: false,
  deliverRules: [],
  dataScrapeEnabled: false,
  scrapeIntervalHours: 6,
  logLevel: "info",
  dataDir: "./data",
};

function parseJsonField<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function loadConfig(overrides?: Partial<AppConfig>): AppConfig {
  const env = process.env;

  const config: AppConfig = {
    ...DEFAULT_CONFIG,
    cookie: env.COOKIE || "",
    userId: env.USER_ID || "",
    deviceId: env.DEVICE_ID || "",
    token: env.TOKEN || "",
    xSignServiceUrl: env.XSIGN_SERVICE_URL || DEFAULT_CONFIG.xSignServiceUrl,
    apiBaseUrl: env.API_BASE_URL || DEFAULT_CONFIG.apiBaseUrl,
    wsUrl: env.WS_URL || DEFAULT_CONFIG.wsUrl,
    autoReplyEnabled: env.AUTO_REPLY_ENABLED === "true",
    autoReplyRules: parseJsonField(env.AUTO_REPLY_RULES, DEFAULT_CONFIG.autoReplyRules),
    defaultReply: env.DEFAULT_REPLY || DEFAULT_CONFIG.defaultReply,
    autoPolishEnabled: env.AUTO_POLISH_ENABLED === "true",
    polishIntervalHours: parseInt(env.POLISH_INTERVAL_HOURS || "8", 10),
    priceMonitorEnabled: env.PRICE_MONITOR_ENABLED === "true",
    priceCheckIntervalMinutes: parseInt(env.PRICE_CHECK_INTERVAL_MINUTES || "30", 10),
    autoListEnabled: env.AUTO_LIST_ENABLED === "true",
    autoDeliverEnabled: env.AUTO_DELIVER_ENABLED === "true",
    deliverRules: parseJsonField(env.DELIVER_RULES, DEFAULT_CONFIG.deliverRules),
    dataScrapeEnabled: env.DATA_SCRAPE_ENABLED === "true",
    scrapeIntervalHours: parseInt(env.SCRAPE_INTERVAL_HOURS || "6", 10),
    logLevel: env.LOG_LEVEL || DEFAULT_CONFIG.logLevel,
    dataDir: env.DATA_DIR || DEFAULT_CONFIG.dataDir,
    ...overrides,
  };

  const dataDir = path.resolve(config.dataDir);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  return config;
}

export function validateConfig(config: AppConfig): string[] {
  const errors: string[] = [];
  if (!config.cookie) errors.push("COOKIE is required");
  if (!config.userId) errors.push("USER_ID is required");
  if (!config.token) errors.push("TOKEN is required");
  return errors;
}
