import WebSocket from "ws";
import EventEmitter from "eventemitter3";
import type { AppConfig } from "./config.js";
import type { AuthSession } from "./auth.js";
import { logger } from "../utils/logger.js";

interface WsMessage {
  type: string;
  data: Record<string, unknown>;
  timestamp?: number;
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

    // Build ACCS WebSocket URL: base + /accs/auth?token=xxx
    const baseUrl = this.config.wsUrl.replace(/\/+$/, "");
    const wsUrl = `${baseUrl}/accs/auth?token=${encodeURIComponent(this.session.token)}`;
    logger.info(`Connecting to WebSocket: ${baseUrl}/accs/auth?token=***`, { module: "ws" });

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(wsUrl, {
          headers: {
            Cookie: this.session.cookie,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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
          this.startHeartbeat();
          this.emit("connected");
          resolve();
        });

        this.ws.on("message", (rawData: WebSocket.Data) => {
          try {
            const message = JSON.parse(rawData.toString()) as WsMessage;
            this.handleMessage(message);
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

  private handleMessage(message: WsMessage): void {
    switch (message.type) {
      case "chat":
      case "im_message":
        this.handleChatMessage(message);
        break;
      case "heartbeat":
      case "ping":
        this.sendPong();
        break;
      case "notification":
        this.emit("notification", message.data);
        break;
      default:
        logger.debug("Unknown WS message type", { module: "ws", type: message.type });
    }
  }

  private handleChatMessage(message: WsMessage): void {
    const data = message.data;
    const chatMessage: ChatMessage = {
      sessionId: String(data.sessionId || data.session_id || ""),
      buyerId: String(data.fromUserId || data.from_user_id || data.buyerId || ""),
      buyerName: String(data.fromUserName || data.from_user_name || data.buyerName || ""),
      itemId: String(data.itemId || data.item_id || ""),
      content: String(data.content || data.message || ""),
      timestamp: Number(data.timestamp || Date.now()),
      messageId: String(data.messageId || data.message_id || ""),
    };

    if (chatMessage.content) {
      logger.info("New chat message", {
        module: "ws",
        buyer: chatMessage.buyerName,
        item: chatMessage.itemId,
        content: chatMessage.content.slice(0, 50),
      });
      this.emit("chat_message", chatMessage);
    }
  }

  private sendPong(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "pong" }));
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "heartbeat", timestamp: Date.now() }));
      }
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
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

  sendMessage(sessionId: string, content: string): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      logger.warn("Cannot send message: WebSocket not connected", { module: "ws" });
      return;
    }

    this.ws.send(
      JSON.stringify({
        type: "send_message",
        data: {
          sessionId,
          content,
          timestamp: Date.now(),
        },
      })
    );
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
