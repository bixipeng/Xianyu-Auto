import path from "node:path";
import { JsonFileStore } from "../utils/json-store.js";
import { logger } from "../utils/logger.js";

export interface StoredMessage {
  sessionId: string;
  buyerId: string;
  buyerName: string;
  itemId: string;
  content: string;
  timestamp: number;
  messageId: string;
  direction: "in" | "out";
  autoReplied?: boolean;
  replyContent?: string;
}

const MAX_MESSAGES = 2000;

/**
 * 消息持久化存储
 * 将 WebSocket 收到的消息保存到本地 JSON 文件，支持历史记录查询。
 */
export class MessageStore {
  private filePath: string;
  private cache: StoredMessage[] | null = null;

  constructor(dataDir: string) {
    this.filePath = path.join(dataDir, "messages.json");
  }

  async load(): Promise<StoredMessage[]> {
    if (this.cache) return this.cache;
    this.cache = await JsonFileStore.read<StoredMessage[]>(this.filePath, []);
    logger.info(`MessageStore: loaded ${this.cache.length} messages from disk`, { module: "message-store" });
    return this.cache;
  }

  async addMessage(msg: StoredMessage): Promise<void> {
    await this.load(); // ensure cache is loaded
    await JsonFileStore.update<StoredMessage[]>(
      this.filePath,
      (messages) => {
        // Deduplicate by messageId
        if (msg.messageId && messages.some((m) => m.messageId === msg.messageId)) {
          return messages;
        }
        messages.push(msg);
        // Keep only the latest MAX_MESSAGES
        if (messages.length > MAX_MESSAGES) {
          messages = messages.slice(-MAX_MESSAGES);
        }
        // Sort by timestamp descending (newest first)
        messages.sort((a, b) => b.timestamp - a.timestamp);
        this.cache = messages;
        return messages;
      },
      []
    );
  }

  async getMessages(limit = 100, offset = 0): Promise<StoredMessage[]> {
    const all = await this.load();
    // Already sorted newest first
    return all.slice(offset, offset + limit);
  }

  async getMessagesBySession(sessionId: string, limit = 50): Promise<StoredMessage[]> {
    const all = await this.load();
    return all
      .filter((m) => m.sessionId === sessionId)
      .slice(0, limit);
  }

  async getSessions(): Promise<Array<{ sessionId: string; buyerName: string; lastMessage: string; lastTimestamp: number; count: number }>> {
    const all = await this.load();
    const sessionMap = new Map<string, { buyerName: string; lastMessage: string; lastTimestamp: number; count: number }>();

    for (const msg of all) {
      const existing = sessionMap.get(msg.sessionId);
      if (!existing || msg.timestamp > existing.lastTimestamp) {
        sessionMap.set(msg.sessionId, {
          buyerName: msg.buyerName || existing?.buyerName || "",
          lastMessage: msg.content,
          lastTimestamp: msg.timestamp,
          count: (existing?.count || 0) + 1,
        });
      } else {
        existing.count++;
      }
    }

    return Array.from(sessionMap.entries())
      .map(([sessionId, info]) => ({ sessionId, ...info }))
      .sort((a, b) => b.lastTimestamp - a.lastTimestamp);
  }

  async clear(): Promise<void> {
    await JsonFileStore.write(this.filePath, []);
    this.cache = [];
  }
}
