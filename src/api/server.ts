import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import type { AppConfig } from "../core/config.js";
import type { XianyuClient } from "../core/client.js";
import type { XianyuWebSocket, ChatMessage } from "../core/websocket.js";
import type { ProductManager } from "../features/product-manager.js";
import type { AutoReply } from "../features/auto-reply.js";
import type { PriceMonitor } from "../features/price-monitor.js";
import type { DataScraper } from "../features/data-scraper.js";
import type { AutoDeliver } from "../features/auto-deliver.js";
import type { MessageStore } from "../features/message-store.js";
import type { TaskScheduler } from "../scheduler.js";
import { logger } from "../utils/logger.js";

export interface AppContext {
  config: AppConfig;
  client: XianyuClient;
  ws: XianyuWebSocket;
  productManager: ProductManager;
  autoReply: AutoReply | null;
  priceMonitor: PriceMonitor;
  dataScraper: DataScraper;
  autoDeliver: AutoDeliver | null;
  messageStore: MessageStore;
  scheduler: TaskScheduler;
}

// Store recent chat messages in memory (up to 200) for SSE streaming
const recentMessages: (ChatMessage & { autoReplied?: boolean; replyContent?: string })[] = [];

export function createApiServer(ctx: AppContext): express.Application {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Global request logger
  app.use((req, _res, next) => {
    if (req.url.startsWith("/api/")) {
      logger.info(`→ ${req.method} ${req.url}`, { module: "api" });
    }
    next();
  });

  // Serve static frontend files (no-cache for dev)
  const staticDir = path.resolve("frontend/dist");
  if (fs.existsSync(staticDir)) {
    app.use(express.static(staticDir, {
      etag: false,
      lastModified: false,
      setHeaders: (res) => {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader("Pragma", "no-cache");
      },
    }));
  }

  // Persist all incoming chat messages to local store
  ctx.ws.on("chat_message", async (msg: ChatMessage) => {
    try {
      await ctx.messageStore.addMessage({ ...msg, direction: "in" });
    } catch (error) {
      logger.error("Failed to persist chat message", { module: "api", error: String(error) });
    }
  });

  // ---- Status ----
  app.get("/api/status", (_req, res) => {
    const wsState = ctx.ws.isConnected() ? "connected" : "disconnected";
    res.json({
      websocket: wsState,
      features: {
        autoReply: ctx.config.autoReplyEnabled,
        autoPolish: ctx.config.autoPolishEnabled,
        priceMonitor: ctx.config.priceMonitorEnabled,
        dataScrape: ctx.config.dataScrapeEnabled,
        autoDeliver: ctx.config.autoDeliverEnabled,
      },
      scheduler: {
        activeJobs: ctx.scheduler.getActiveJobs?.() ?? 0,
      },
      session: {
        userId: ctx.config.userId,
        deviceId: ctx.config.deviceId ? ctx.config.deviceId.slice(0, 8) + "..." : "",
      },
      signService: ctx.config.xSignServiceUrl,
    });
  });

  // ---- Products ----
  app.get("/api/products", async (req, res) => {
    logger.info("API /api/products called", { module: "api", page: req.query.page, pageSize: req.query.pageSize });
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const products = await ctx.productManager.getMyProducts(page, pageSize);
      logger.info(`API /api/products returning ${products.length} products`, { module: "api" });
      res.json({ success: true, data: products });
    } catch (error) {
      logger.error("API /api/products error", { module: "api", error: String(error) });
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const detail = await ctx.productManager.getProductDetail(req.params.id);
      res.json({ success: true, data: detail });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  app.post("/api/products/:id/polish", async (req, res) => {
    try {
      await ctx.productManager.polishProduct(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  app.post("/api/products/polish-all", async (_req, res) => {
    try {
      await ctx.productManager.polishAllProducts();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  app.post("/api/products/:id/offline", async (req, res) => {
    try {
      await ctx.productManager.offlineProduct(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    try {
      await ctx.productManager.deleteProduct(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // ---- Auto Reply ----
  app.get("/api/reply/stats", (_req, res) => {
    const stats = ctx.autoReply?.getStats() ?? { totalReplied: 0, uniqueBuyers: 0 };
    res.json({ success: true, data: stats });
  });

  app.get("/api/reply/rules", (_req, res) => {
    res.json({
      success: true,
      data: {
        rules: ctx.config.autoReplyRules,
        defaultReply: ctx.config.defaultReply,
        enabled: ctx.config.autoReplyEnabled,
      },
    });
  });

  app.put("/api/reply/rules", (req, res) => {
    const { rules, defaultReply } = req.body;
    if (rules) ctx.config.autoReplyRules = rules;
    if (defaultReply !== undefined) ctx.config.defaultReply = defaultReply;
    res.json({ success: true });
  });

  app.post("/api/reply/send", async (req, res) => {
    try {
      const { buyerId, content } = req.body;
      if (!buyerId || !content) {
        res.status(400).json({ success: false, error: "buyerId and content required" });
        return;
      }
      await ctx.autoReply?.sendManualReply(buyerId, content);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // ---- Messages (historical + real-time) ----
  app.get("/api/messages", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      const messages = await ctx.messageStore.getMessages(limit, offset);
      res.json({ success: true, data: messages, total: (await ctx.messageStore.load()).length });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  app.get("/api/messages/sessions", async (_req, res) => {
    try {
      const sessions = await ctx.messageStore.getSessions();
      res.json({ success: true, data: sessions });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  app.get("/api/messages/session/:sessionId", async (req, res) => {
    try {
      const messages = await ctx.messageStore.getMessagesBySession(req.params.sessionId);
      res.json({ success: true, data: messages });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // SSE for real-time messages
  app.get("/api/messages/stream", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

    const onMessage = (msg: ChatMessage) => {
      const enriched = { ...msg, autoReplied: false };
      recentMessages.push(enriched);
      if (recentMessages.length > 200) recentMessages.shift();
      res.write(`data: ${JSON.stringify(enriched)}\n\n`);
    };

    ctx.ws.on("chat_message", onMessage);
    req.on("close", () => {
      ctx.ws.off("chat_message", onMessage);
    });
  });

  // ---- Price Monitor ----
  app.get("/api/price/alerts", (_req, res) => {
    const alerts = ctx.priceMonitor.getAlerts();
    res.json({ success: true, data: alerts });
  });

  app.get("/api/price/history/:itemId", (req, res) => {
    const history = ctx.priceMonitor.getPriceHistory(req.params.itemId);
    res.json({ success: true, data: history });
  });

  app.get("/api/price/trend/:itemId", (req, res) => {
    const trend = ctx.priceMonitor.getTrend(req.params.itemId);
    res.json({ success: true, data: trend });
  });

  app.post("/api/price/check", async (_req, res) => {
    try {
      await ctx.priceMonitor.checkAllMyProducts();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // ---- Data Scraper ----
  app.get("/api/scraper/stats", async (_req, res) => {
    try {
      const stats = await ctx.dataScraper.getMyProductStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  app.get("/api/scraper/search", async (req, res) => {
    try {
      const keyword = req.query.keyword as string;
      const page = parseInt(req.query.page as string) || 1;
      if (!keyword) {
        res.status(400).json({ success: false, error: "keyword required" });
        return;
      }
      const items = await ctx.dataScraper.searchItems(keyword, page);
      res.json({ success: true, data: items });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  app.post("/api/scraper/export", async (_req, res) => {
    try {
      const report = await ctx.dataScraper.exportReport();
      res.json({ success: true, data: report });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // ---- Auto Deliver ----
  app.get("/api/deliver/stats", (_req, res) => {
    const stats = ctx.autoDeliver?.getStats() ?? { totalDelivered: 0, uniqueBuyers: 0 };
    res.json({ success: true, data: stats });
  });

  app.get("/api/deliver/records", (_req, res) => {
    res.json({ success: true, data: [] });
  });

  app.get("/api/deliver/rules", (_req, res) => {
    res.json({
      success: true,
      data: {
        rules: ctx.config.deliverRules,
        enabled: ctx.config.autoDeliverEnabled,
      },
    });
  });

  app.put("/api/deliver/rules", (req, res) => {
    const { rules } = req.body;
    if (rules) ctx.config.deliverRules = rules;
    res.json({ success: true });
  });

  // ---- Config ----
  app.get("/api/config", (_req, res) => {
    const safe = { ...ctx.config };
    // Mask sensitive fields
    safe.cookie = safe.cookie ? safe.cookie.slice(0, 20) + "***" : "";
    safe.token = safe.token ? safe.token.slice(0, 10) + "***" : "";
    res.json({ success: true, data: safe });
  });

  app.put("/api/config", (req, res) => {
    const updates = req.body;
    const hotReloadKeys = [
      "autoReplyEnabled", "autoPolishEnabled", "priceMonitorEnabled",
      "dataScrapeEnabled", "autoDeliverEnabled", "defaultReply",
      "logLevel", "polishIntervalHours", "priceCheckIntervalMinutes",
      "scrapeIntervalHours",
    ];
    let needsRestart = false;
    for (const [key, value] of Object.entries(updates)) {
      if (key in ctx.config && key !== "cookie" && key !== "token") {
        (ctx.config as Record<string, unknown>)[key] = value;
        if (!hotReloadKeys.includes(key)) needsRestart = true;
      }
    }
    res.json({ success: true, needsRestart });
  });

  // ---- Scheduler ----
  app.post("/api/scheduler/restart", (_req, res) => {
    try {
      ctx.scheduler.stop();
      ctx.scheduler.start();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // SPA fallback - serve index.html for all non-API routes
  app.get("/{*splat}", (_req, res) => {
    const indexPath = path.join(staticDir, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({ error: "Frontend not built yet. Run: cd frontend && npm run build" });
    }
  });

  return app;
}

export function startApiServer(ctx: AppContext, port = 3000): void {
  const app = createApiServer(ctx);
  app.listen(port, () => {
    logger.info(`Management API running on http://localhost:${port}`, { module: "api" });
    logger.info(`Dashboard: http://localhost:${port}`, { module: "api" });
  });
}
