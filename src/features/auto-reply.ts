import type { XianyuClient } from "../core/client.js";
import type { XianyuWebSocket, ChatMessage } from "../core/websocket.js";
import type { AppConfig } from "../core/config.js";
import { logger } from "../utils/logger.js";
import { sleep } from "../utils/helpers.js";

export class AutoReply {
  private client: XianyuClient;
  private ws: XianyuWebSocket;
  private config: AppConfig;
  private repliedMessages = new Set<string>();
  private replyCooldownMs = 60000;
  private recentReplies = new Map<string, number>();

  constructor(client: XianyuClient, ws: XianyuWebSocket, config: AppConfig) {
    this.client = client;
    this.ws = ws;
    this.config = config;
    this.setupListeners();
  }

  private setupListeners(): void {
    this.ws.on("chat_message", (message: ChatMessage) => {
      this.handleMessage(message).catch((error) => {
        logger.error("Auto-reply error", {
          module: "auto-reply",
          error: error instanceof Error ? error.message : String(error),
        });
      });
    });
  }

  private async handleMessage(message: ChatMessage): Promise<void> {
    const buyerId = message.buyerId;
    const sessionId = message.sessionId;

    if (!buyerId || !sessionId) {
      logger.warn("Missing buyerId or sessionId", { module: "auto-reply" });
      return;
    }

    const deduplicateKey = `${buyerId}:${message.messageId}`;
    if (this.repliedMessages.has(deduplicateKey)) {
      return;
    }

    const lastReplyTime = this.recentReplies.get(buyerId) || 0;
    if (Date.now() - lastReplyTime < this.replyCooldownMs) {
      logger.debug("Cooldown active for buyer", { module: "auto-reply", buyerId });
      return;
    }

    const content = message.content.toLowerCase().trim();
    const reply = this.matchReply(content);

    if (reply) {
      await sleep(Math.random() * 2000 + 1000);
      await this.sendReply(sessionId, reply);
      this.repliedMessages.add(deduplicateKey);
      this.recentReplies.set(buyerId, Date.now());

      if (this.repliedMessages.size > 10000) {
        this.repliedMessages.clear();
      }

      logger.info("Auto-replied", {
        module: "auto-reply",
        buyer: message.buyerName,
        reply: reply.slice(0, 50),
      });
    }
  }

  private matchReply(content: string): string | null {
    for (const rule of this.config.autoReplyRules) {
      const matched = rule.keywords.some((keyword) => content.includes(keyword.toLowerCase()));
      if (matched) {
        return rule.reply;
      }
    }

    if (this.config.defaultReply) {
      return this.config.defaultReply;
    }

    return null;
  }

  async sendReply(sessionId: string, content: string): Promise<void> {
    try {
      await this.client.post("mtop.idle.im.send", {
        sessionId,
        content,
        type: 1,
      });
    } catch (error) {
      logger.error("Failed to send reply via API, falling back to WebSocket", {
        module: "auto-reply",
        error: error instanceof Error ? error.message : String(error),
      });
      this.ws.sendMessage(sessionId, content);
    }
  }

  async sendManualReply(buyerId: string, content: string): Promise<void> {
    const sessionId = await this.getSessionId(buyerId);
    if (sessionId) {
      await this.sendReply(sessionId, content);
    } else {
      logger.error("No session found for buyer", { module: "auto-reply", buyerId });
    }
  }

  private async getSessionId(buyerId: string): Promise<string | null> {
    try {
      const result = await this.client.get<{ data: { sessionId: string } }>("mtop.idle.im.session", {
        targetUserId: buyerId,
      });
      return result.data.sessionId || null;
    } catch {
      return null;
    }
  }

  getStats(): { totalReplied: number; uniqueBuyers: number } {
    return {
      totalReplied: this.repliedMessages.size,
      uniqueBuyers: this.recentReplies.size,
    };
  }
}
