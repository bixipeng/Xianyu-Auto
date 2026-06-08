import type { XianyuClient } from "../core/client.js";
import { logger } from "../utils/logger.js";
import { formatPrice, sleep } from "../utils/helpers.js";
import { JsonFileStore } from "../utils/json-store.js";
import fs from "node:fs/promises";
import path from "node:path";

export interface PriceRecord {
  itemId: string;
  title: string;
  price: number;
  previousPrice?: number;
  timestamp: number;
  changeType?: "increase" | "decrease" | "stable";
}

export interface PriceAlert {
  itemId: string;
  title: string;
  oldPrice: number;
  newPrice: number;
  changePercent: number;
  timestamp: number;
}

export class PriceMonitor {
  private client: XianyuClient;
  private dataDir: string;
  private priceHistory: Map<string, PriceRecord[]> = new Map();
  private alerts: PriceAlert[] = [];
  private alertThresholdPercent = 10;

  constructor(client: XianyuClient, dataDir: string) {
    this.client = client;
    this.dataDir = dataDir;
  }

  async checkPrice(itemId: string): Promise<PriceRecord | null> {
    try {
      const detail = await this.client.get<{
        data: { title: string; price: number };
      }>("mtop.idle.item.detail", { itemId });

      const currentPrice = Number(detail.data.price) / 100;
      const title = String(detail.data.title || "");

      const history = this.priceHistory.get(itemId) || [];
      const lastRecord = history.length > 0 ? history[history.length - 1] : undefined;

      let changeType: PriceRecord["changeType"] = "stable";
      if (lastRecord) {
        if (currentPrice > lastRecord.price) changeType = "increase";
        else if (currentPrice < lastRecord.price) changeType = "decrease";
      }

      const record: PriceRecord = {
        itemId,
        title,
        price: currentPrice,
        previousPrice: lastRecord?.price,
        timestamp: Date.now(),
        changeType,
      };

      history.push(record);
      if (history.length > 100) history.shift();
      this.priceHistory.set(itemId, history);

      if (changeType !== "stable" && lastRecord) {
        this.checkAlert(record, lastRecord);
      }

      return record;
    } catch (error) {
      logger.error("Failed to check price", {
        module: "price-monitor",
        itemId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async checkAllMyProducts(): Promise<PriceRecord[]> {
    logger.info("Checking prices for all products", { module: "price-monitor" });
    const records: PriceRecord[] = [];

    try {
      const result = await this.client.get<{
        data: { items: Array<{ itemId: string }> };
      }>("mtop.idle.my.items", { page: 1, pageSize: 100 });

      const items = result.data.items || [];
      for (const item of items) {
        const record = await this.checkPrice(String(item.itemId));
        if (record) records.push(record);
        await sleep(Math.random() * 2000 + 1000);
      }
    } catch (error) {
      logger.error("Failed to fetch my items for price check", {
        module: "price-monitor",
        error: error instanceof Error ? error.message : String(error),
      });
    }

    await this.savePriceHistory();
    return records;
  }

  private checkAlert(current: PriceRecord, previous: PriceRecord): void {
    const changePercent = Math.abs((current.price - previous.price) / previous.price) * 100;
    if (changePercent >= this.alertThresholdPercent) {
      const alert: PriceAlert = {
        itemId: current.itemId,
        title: current.title,
        oldPrice: previous.price,
        newPrice: current.price,
        changePercent,
        timestamp: Date.now(),
      };

      this.alerts.push(alert);
      if (this.alerts.length > 1000) this.alerts = this.alerts.slice(-1000);

      logger.warn("Price alert triggered", {
        module: "price-monitor",
        title: current.title,
        oldPrice: formatPrice(previous.price * 100),
        newPrice: formatPrice(current.price * 100),
        change: `${changePercent.toFixed(1)}%`,
      });
    }
  }

  getPriceHistory(itemId: string): PriceRecord[] {
    return this.priceHistory.get(itemId) || [];
  }

  getAlerts(): PriceAlert[] {
    return this.alerts;
  }

  getTrend(itemId: string): { direction: "up" | "down" | "stable"; avgPrice: number; dataPoints: number } {
    const history = this.priceHistory.get(itemId) || [];
    if (history.length < 2) {
      return { direction: "stable", avgPrice: history[0]?.price || 0, dataPoints: history.length };
    }

    const first = history[0].price;
    const last = history[history.length - 1].price;
    const avgPrice = history.reduce((sum, r) => sum + r.price, 0) / history.length;

    return {
      direction: last > first ? "up" : last < first ? "down" : "stable",
      avgPrice: Math.round(avgPrice * 100) / 100,
      dataPoints: history.length,
    };
  }

  setAlertThreshold(percent: number): void {
    this.alertThresholdPercent = percent;
  }

  private async savePriceHistory(): Promise<void> {
    const filePath = path.join(this.dataDir, "price-history.json");
    const data = Object.fromEntries(this.priceHistory);
    await JsonFileStore.write(filePath, data);
  }

  async loadPriceHistory(): Promise<void> {
    const filePath = path.join(this.dataDir, "price-history.json");
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(content) as Record<string, PriceRecord[]>;
      for (const [itemId, records] of Object.entries(data)) {
        this.priceHistory.set(itemId, records);
      }
      logger.info(`Loaded price history for ${this.priceHistory.size} items`, { module: "price-monitor" });
    } catch {
      logger.debug("No existing price history found", { module: "price-monitor" });
    }
  }
}
