import fs from "node:fs/promises";
import { logger } from "./logger.js";

/**
 * JSON 文件持久化存储，内置写入队列防止并发写入导致数据丢失。
 * 所有对同一文件的写操作会被串行化执行。
 */
export class JsonFileStore {
  /** 按文件路径维护的写入队列 */
  private static writeQueues = new Map<string, Promise<void>>();

  /**
   * 读取 JSON 文件，文件不存在时返回 fallback 值
   */
  static async read<T>(filePath: string, fallback: T): Promise<T> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      return JSON.parse(content) as T;
    } catch {
      return fallback;
    }
  }

  /**
   * 写入 JSON 文件（通过写入队列串行化）
   * 多次调用会排队执行，不会互相覆盖
   */
  static async write<T>(filePath: string, data: T): Promise<void> {
    const previous = this.writeQueues.get(filePath) ?? Promise.resolve();

    const next = previous.then(async () => {
      try {
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
      } catch (error) {
        logger.error("JsonFileStore: failed to write file", {
          module: "json-store",
          filePath,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    });

    this.writeQueues.set(filePath, next);
    await next;
  }

  /**
   * 原子更新：读取 → 执行 updater → 写入，全程串行化
   * 这是最常用的方法，确保 read-modify-write 的完整性
   */
  static async update<T>(
    filePath: string,
    updater: (data: T) => T,
    fallback: T
  ): Promise<T> {
    const previous = this.writeQueues.get(filePath) ?? Promise.resolve();

    let result: T = fallback;

    const next = previous.then(async () => {
      try {
        const current = await this.read<T>(filePath, fallback);
        result = updater(current);
        await fs.writeFile(filePath, JSON.stringify(result, null, 2), "utf-8");
      } catch (error) {
        logger.error("JsonFileStore: failed to update file", {
          module: "json-store",
          filePath,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    });

    this.writeQueues.set(filePath, next);
    await next;
    return result;
  }
}
