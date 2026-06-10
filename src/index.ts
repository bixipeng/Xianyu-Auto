import { loadConfig, validateConfig } from "./core/config.js";
import { createSession, isSessionValid } from "./core/auth.js";
import { XianyuClient } from "./core/client.js";
import { XianyuWebSocket } from "./core/websocket.js";
import { ProductManager } from "./features/product-manager.js";
import { AutoReply } from "./features/auto-reply.js";
import { PriceMonitor } from "./features/price-monitor.js";
import { DataScraper } from "./features/data-scraper.js";
import { AutoDeliver } from "./features/auto-deliver.js";
import { MessageStore } from "./features/message-store.js";
import { TaskScheduler } from "./scheduler.js";
import { startApiServer } from "./api/server.js";
import { logger } from "./utils/logger.js";

async function main(): Promise<void> {
  logger.info("Starting XianYu Auto...", { module: "main" });

  const config = loadConfig();
  const errors = validateConfig(config);
  if (errors.length > 0) {
    logger.error("Configuration errors:", { errors });
    process.exit(1);
  }

  const session = createSession(config);
  if (!isSessionValid(session)) {
    logger.error("Invalid session, check your cookie and token");
    process.exit(1);
  }

  const client = new XianyuClient(config, session);
  const ws = new XianyuWebSocket(config, session);

  const productManager = new ProductManager(client, config.dataDir);
  const priceMonitor = new PriceMonitor(client, config.dataDir);
  const dataScraper = new DataScraper(client, config.dataDir);
  const messageStore = new MessageStore(config.dataDir);
  await messageStore.load();

  let autoReply: AutoReply | null = null;
  if (config.autoReplyEnabled) {
    autoReply = new AutoReply(client, ws, config);
    logger.info("Auto-reply enabled", { module: "main" });
  }

  let autoDeliver: AutoDeliver | null = null;
  if (config.autoDeliverEnabled) {
    autoDeliver = new AutoDeliver(client, ws, config, config.dataDir);
    logger.info("Auto-deliver enabled", { module: "main" });
  }

  await priceMonitor.loadPriceHistory();
  await autoDeliver?.loadDeliverRecords();

  const scheduler = new TaskScheduler(productManager, priceMonitor, dataScraper, {
    polishEnabled: config.autoPolishEnabled,
    polishIntervalHours: config.polishIntervalHours,
    priceMonitorEnabled: config.priceMonitorEnabled,
    priceCheckIntervalMinutes: config.priceCheckIntervalMinutes,
    dataScrapeEnabled: config.dataScrapeEnabled,
    scrapeIntervalHours: config.scrapeIntervalHours,
  });

  try {
    await ws.connect();
    logger.info("WebSocket connected, listening for messages", { module: "main" });

    ws.on("disconnected", () => {
      logger.warn("WebSocket disconnected, will attempt reconnect", { module: "main" });
    });

    ws.on("max_reconnect", () => {
      logger.error("Max reconnection attempts reached", { module: "main" });
    });

    scheduler.start();

    // Start management API server
    const apiPort = parseInt(process.env.API_PORT || "3000", 10);
    startApiServer({
      config, client, ws, productManager, autoReply,
      priceMonitor, dataScraper, autoDeliver, messageStore, scheduler,
    }, apiPort);

    logger.info("XianYu Auto is running!", {
      module: "main",
      features: {
        autoReply: config.autoReplyEnabled,
        autoPolish: config.autoPolishEnabled,
        priceMonitor: config.priceMonitorEnabled,
        dataScrape: config.dataScrapeEnabled,
        autoDeliver: config.autoDeliverEnabled,
      },
    });

    process.on("SIGINT", () => shutdown(ws, scheduler));
    process.on("SIGTERM", () => shutdown(ws, scheduler));
  } catch (error) {
    logger.error("Failed to start", {
      module: "main",
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

function shutdown(ws: XianyuWebSocket, scheduler: TaskScheduler): void {
  logger.info("Shutting down...", { module: "main" });
  ws.disconnect();
  scheduler.stop();
  process.exit(0);
}

main().catch((error) => {
  logger.error("Unhandled error", { error: String(error) });
  process.exit(1);
});
