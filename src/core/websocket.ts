import WebSocket from "ws";
import EventEmitter from "eventemitter3";
import { unpackMultiple } from "msgpackr";
import type { AppConfig } from "./config.js";
import type { AuthSession } from "./auth.js";
import { logger } from "../utils/logger.js";

// ACCS protocol interfaces
interface AccsMessage {
  lwp?: string;
  headers?: Record<string, unknown>;
  body?: unknown;
  code?: number;
}

export interface ChatMessage {
  sessionId: string;
  buyerId: string;
  buyerName: string;
  itemId: string;
  content: string;
  timestamp: number;
  messageId: string;
}

// Generate a unique message ID for ACCS protocol
function generateMid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export class XianyuWebSocket extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: AppConfig;
  private session: AuthSession;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private isConnecting = false;

  constructor(config: AppConfig, session: AuthSession) {
    super();
    this.config = config;
    this.session = session;
  }

  async connect(): Promise<void> {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.isConnecting = true;

    // ACCS WebSocket URL - keep /accs/auth path with token (works for initial auth)
    const baseUrl = this.config.wsUrl.replace(/\/+$/, "");
    const wsUrl = `${baseUrl}/accs/auth?token=${encodeURIComponent(this.session.token)}`;
    logger.info(`Connecting to WebSocket: ${baseUrl}/accs/auth?token=***`, { module: "ws" });

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(wsUrl, {
          headers: {
            Cookie: this.session.cookie,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 DingTalk(2.2.0)",
            Origin: "https://www.goofish.com",
            "x-accs-app-key": "444e9908a51d1cb236a27862abc769c9",
            "x-accs-app-name": "goofish",
            "x-accs-device-id": `${this.session.deviceId}-${this.session.userId}`,
          },
        });

        this.ws.on("open", () => {
          logger.info("WebSocket connected", { module: "ws" });
          this.isConnecting = false;
          this.reconnectAttempts = 0;

          // ACCS protocol: send registration message after connect
          this.sendRegistration();
          this.startHeartbeat();
          this.emit("connected");
          resolve();
        });

        this.ws.on("message", (rawData: WebSocket.Data) => {
          try {
            const text = rawData.toString();
            const message = JSON.parse(text) as AccsMessage;
            this.handleAccsMessage(message);
          } catch (error) {
            logger.warn("Failed to parse WS message", {
              module: "ws",
              error: error instanceof Error ? error.message : String(error),
            });
          }
        });

        this.ws.on("close", (code: number, reason: Buffer) => {
          logger.warn("WebSocket disconnected", {
            module: "ws",
            code,
            reason: reason.toString(),
          });
          this.isConnecting = false;
          this.stopHeartbeat();
          this.emit("disconnected", { code, reason: reason.toString() });
          this.scheduleReconnect();
        });

        this.ws.on("error", (error: Error) => {
          logger.error("WebSocket error", { module: "ws", error: error.message });
          this.isConnecting = false;
          this.emit("error", error);
          if (this.reconnectAttempts === 0) {
            reject(error);
          }
        });
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  // ---- ACCS Protocol: Registration ----

  private sendRegistration(): void {
    const regMessage: AccsMessage = {
      lwp: "/reg",
      headers: {
        "cache-header": "app-key token ua wv",
        "app-key": "444e9908a51d1cb236a27862abc769c9",
        token: this.session.token,
        ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        dt: "j",
        wv: "im:3,au:3,sy:6",
        sync: "0,0;0;0;",
        did: `${this.session.deviceId}`,
        mid: generateMid(),
      },
    };
    this.sendJson(regMessage);
    logger.info("ACCS registration sent", { module: "ws" });

    // Send sync status ack after a short delay
    setTimeout(() => {
      this.sendSyncStatusAck();
    }, 500);
  }

  private sendSyncStatusAck(): void {
    const now = Date.now();
    // Request messages from 7 days ago to get recent history
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const ackMessage: AccsMessage = {
      lwp: "/r/SyncStatus/ackDiff",
      headers: { mid: generateMid() },
      body: [
        {
          pipeline: "sync",
          tooLong2Tag: "PNM,1",
          channel: "sync",
          topic: "sync",
          highPts: 0,
          pts: sevenDaysAgo * 1000,
          seq: 0,
          timestamp: sevenDaysAgo,
        },
      ],
    };
    this.sendJson(ackMessage);
    logger.info("ACCS sync status ack sent (requesting 7-day history)", { module: "ws" });
  }

  // ---- ACCS Protocol: Message Handling ----

  private handleAccsMessage(message: AccsMessage): void {
    // ACK all server messages that have headers.mid
    if (message.headers?.mid && !message.code) {
      this.sendAck(message.headers.mid as string, message.headers.sid as string);
    }

    const lwp = message.lwp;

    if (lwp === "/s/sync") {
      // Push sync - contains chat messages
      this.handleSyncPush(message);
    } else if (message.code === 200) {
      // Server ACK response - ignore
      logger.debug("ACCS ACK received", { module: "ws" });
    } else if (lwp === "/!") {
      // Server heartbeat response - ignore
    } else {
      logger.debug("ACCS message", { module: "ws", lwp: lwp || "unknown", code: message.code });
    }
  }

  private sendAck(mid: string, sid?: string): void {
    const ack: Record<string, unknown> = {
      code: 200,
      headers: {
        mid,
        ...(sid ? { sid } : {}),
      },
    };
    this.sendJson(ack);
  }

  // ---- ACCS Protocol: Sync Push (Chat Messages) ----

  private handleSyncPush(message: AccsMessage): void {
    const body = message.body as Record<string, unknown> | undefined;
    if (!body) return;

    const syncPushPackage = body.syncPushPackage as { data?: Array<{ data?: string; bizType?: number }> } | undefined;
    if (!syncPushPackage?.data) return;

    for (const item of syncPushPackage.data) {
      if (!item.data) continue;
      try {
        this.decodeAndEmitChat(item.data);
      } catch (error) {
        logger.debug("Failed to decode sync push item", {
          module: "ws",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private decodeAndEmitChat(base64Data: string): void {
    const buffer = Buffer.from(base64Data, "base64");

    // Strategy A: Try JSON parse first (system messages)
    try {
      const json = JSON.parse(buffer.toString("utf-8"));
      logger.debug("Received JSON system message", { module: "ws", keys: Object.keys(json) });
      this.emit("notification", json);
      return;
    } catch {
      // Not JSON, try MessagePack
    }

    // Strategy B: Decode as MessagePack (chat messages)
    try {
      const results = unpackMultiple(buffer);
      const decoded = results.length === 1 ? results[0] : results;
      this.parseDecodedMessage(decoded);
    } catch (error) {
      logger.debug("Failed to decode MessagePack", {
        module: "ws",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private parseDecodedMessage(decoded: unknown): void {
    if (!decoded || typeof decoded !== "object") return;

    const msg = decoded as Record<string, unknown>;
    const body = msg["1"] as Record<string, unknown> | undefined;
    if (!body) return;

    const detail = body["10"] as Record<string, unknown> | undefined;
    if (!detail) return;

    const reminderContent = detail.reminderContent as string | undefined;
    if (!reminderContent) return;

    // Extract fields from the decoded message
    const senderId = String(body["1"] || detail.senderUserId || "");
    const receiverId = String(body["2"] || "");
    const messageId = String(body["3"] || "");
    const timestamp = Number(body["5"] || Date.now());
    const senderNick = String(detail.senderNick || detail.reminderTitle || "");

    // Extract itemId from reminderUrl (e.g., "itemId=123456&...")
    const reminderUrl = String(detail.reminderUrl || "");
    const itemIdMatch = reminderUrl.match(/itemId=(\d+)/);
    const itemId = itemIdMatch ? itemIdMatch[1] : "";

    // Build session ID from receiverId (strip @goofish suffix)
    const sessionId = receiverId.replace(/@goofish$/, "");

    const chatMessage: ChatMessage = {
      sessionId,
      buyerId: senderId,
      buyerName: senderNick,
      itemId,
      content: reminderContent,
      timestamp,
      messageId,
    };

    logger.info("New chat message", {
      module: "ws",
      buyer: chatMessage.buyerName || chatMessage.buyerId,
      item: chatMessage.itemId,
      content: chatMessage.content.slice(0, 50),
    });

    this.emit("chat_message", chatMessage);
  }

  // ---- ACCS Protocol: Heartbeat ----

  private startHeartbeat(): void {
    // ACCS heartbeat every 10 seconds
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.sendJson({
          lwp: "/!",
          headers: { mid: generateMid() },
        });
      }
    }, 10000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // ---- Send Message (Reply) ----

  sendMessage(sessionId: string, content: string): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      logger.warn("Cannot send message: WebSocket not connected", { module: "ws" });
      return;
    }

    const chatId = sessionId.includes("@goofish") ? sessionId : `${sessionId}@goofish`;
    const payload = {
      message: {
        uuid: `-${Date.now()}${Math.floor(Math.random() * 10)}`,
        cid: chatId,
        conversationType: 1,
        content: {
          contentType: 101,
          custom: {
            type: 1,
            data: Buffer.from(
              JSON.stringify({ contentType: 1, text: { text: content } }),
              "utf-8"
            ).toString("base64"),
          },
        },
        redPointPolicy: 0,
        extension: { extJson: "{}" },
        ctx: { appVersion: "1.0", platform: "web" },
        mtags: {},
        msgReadStatusSetting: 1,
      },
      receivers: {
        actualReceivers: [
          `${this.session.userId}@goofish`,
        ],
      },
    };

    this.sendJson({
      lwp: "/r/MessageSend/sendByReceiverScope",
      headers: { mid: generateMid() },
      body: [payload.message, payload.receivers],
    });

    logger.info("Sent reply via ACCS", { module: "ws", sessionId, content: content.slice(0, 50) });
  }

  // ---- Connection Management ----

  private sendJson(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error("Max reconnection attempts reached", { module: "ws" });
      this.emit("max_reconnect");
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 60000);
    this.reconnectAttempts++;

    logger.info(`Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts})`, {
      module: "ws",
    });

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((error) => {
        logger.error("Reconnection failed", { module: "ws", error: String(error) });
      });
    }, delay);
  }

  disconnect(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }
    this.emit("disconnected", { code: 1000, reason: "Client disconnect" });
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
