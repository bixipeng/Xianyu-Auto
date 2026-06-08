import type { XianyuClient } from "../core/client.js";
import type { XianyuWebSocket, ChatMessage } from "../core/websocket.js";
import type { AppConfig, DeliverRule } from "../core/config.js";
import { logger } from "../utils/logger.js";
import { sleep } from "../utils/helpers.js";
import { JsonFileStore } from "../utils/json-store.js";
import fs from "node:fs/promises";
import path from "node:path";

export interface DeliverRecord {
  buyerId: string;
  buyerName: string;
  itemId: string;
  content: string;
  deliveredAt: number;
  sessionId: string;
}

export class AutoDeliver {
  private client: XianyuClient;
  private ws: XianyuWebSocket;
  private config: AppConfig;
  private dataDir: string;
  private deliveredRecords: DeliverRecord[] = [];

  constructor(client: XianyuClient, ws: XianyuWebSocket, config: AppConfig, dataDir: string) {
    this.client = client;
    this.ws = ws;
    this.config = config;
    this.dataDir = dataDir;
    this.setupListeners();
  }

  private setupListeners(): void {
    this.ws.on("chat_message", (message: ChatMessage) => {
      this.handlePurchaseMessage(message).catch((error) => {
        logger.error("Auto-deliver error", {
          module: "auto-deliver",
          error: error instanceof Error ? error.message : String(error),
        });
      });
    });
  }

  private async handlePurchaseMessage(message: ChatMessage): Promise<void> {
    if (!message.itemId) return;

    const rule = this.findDeliverRule(message.itemId, message.content);
    if (!rule) return;

    logger.info("Matched deliver rule, sending content", {
      module: "auto-deliver",
      itemId: message.itemId,
      buyer: message.buyerName,
    });

    await sleep(Math.random() * 2000 + 1000);
    await this.sendDeliverContent(message.sessionId, rule.deliverContent);

    const record: DeliverRecord = {
      buyerId: message.buyerId,
      buyerName: message.buyerName,
      itemId: message.itemId,
      content: rule.deliverContent,
      deliveredAt: Date.now(),
      sessionId: message.sessionId,
    };

    this.deliveredRecords.push(record);
    await this.saveDeliverRecord(record);
  }

  private findDeliverRule(itemId: string, messageContent: string): DeliverRule | undefined {
    for (const rule of this.config.deliverRules) {
      if (rule.itemId === itemId) {
        const matchedKeyword = rule.keywords.length === 0 ||
          rule.keywords.some((keyword) => messageContent.toLowerCase().includes(keyword.toLowerCase()));
        if (matchedKeyword) {
          return rule;
        }
      }
    }
    return undefined;
  }

  private async sendDeliverContent(sessionId: string, content: string): Promise<void> {
    try {
      await this.client.post("mtop.idle.im.send", {
        sessionId,
        content,
        type: 1,
      });
      logger.info("Deliver content sent successfully", { module: "auto-deliver", sessionId });
    } catch (error) {
      logger.error("Failed to send deliver content", {
        module: "auto-deliver",
        error: error instanceof Error ? error.message : String(error),
      });
      this.ws.sendMessage(sessionId, content);
    }
  }

  async sendManualDeliver(buyerId: string, content: string): Promise<void> {
    try {
      const result = await this.client.get<{ data: { sessionId: string } }>("mtop.idle.im.session", {
        targetUserId: buyerId,
      });

      const sessionId = result.data.sessionId;
      if (sessionId) {
        await this.sendDeliverContent(sessionId, content);
      } else {
        logger.error("No session found for buyer", { module: "auto-deliver", buyerId });
      }
    } catch (error) {
      logger.error("Manual deliver failed", {
        module: "auto-deliver",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async saveDeliverRecord(record: DeliverRecord): Promise<void> {
    const filePath = path.join(this.dataDir, "deliver-records.json");
    await JsonFileStore.update<DeliverRecord[]>(
      filePath,
      (records) => {
        records.push(record);
        if (records.length > 1000) records = records.slice(-1000);
        return records;
      },
      []
    );
  }

  async loadDeliverRecords(): Promise<DeliverRecord[]> {
    const filePath = path.join(this.dataDir, "deliver-records.json");
    try {
      const content = await fs.readFile(filePath, "utf-8");
      this.deliveredRecords = JSON.parse(content);
      return this.deliveredRecords;
    } catch {
      return [];
    }
  }

  getStats(): { totalDelivered: number; uniqueBuyers: number } {
    const uniqueBuyers = new Set(this.deliveredRecords.map((r) => r.buyerId));
    return {
      totalDelivered: this.deliveredRecords.length,
      uniqueBuyers: uniqueBuyers.size,
    };
  }
}
