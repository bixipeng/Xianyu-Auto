import type { XianyuClient } from "../core/client.js";
import { logger } from "../utils/logger.js";
import { sleep } from "../utils/helpers.js";
import fs from "node:fs/promises";
import path from "node:path";

export interface ScrapedItem {
  itemId: string;
  title: string;
  price: number;
  sellerId: string;
  sellerName: string;
  location: string;
  images: string[];
  description: string;
  views: number;
  likes: number;
  publishedAt: number;
  scrapedAt: number;
}

export interface ScrapeStats {
  totalScraped: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  topLocations: Array<{ location: string; count: number }>;
}

export class DataScraper {
  private client: XianyuClient;
  private dataDir: string;
  private scrapedItems: ScrapedItem[] = [];

  constructor(client: XianyuClient, dataDir: string) {
    this.client = client;
    this.dataDir = dataDir;
  }

  async searchItems(keyword: string, page = 1, pageSize = 20): Promise<ScrapedItem[]> {
    logger.info("Searching items", { module: "scraper", keyword, page });

    const result = await this.client.get<{
      data: {
        items: Array<Record<string, unknown>>;
        hasMore: boolean;
        totalCount: number;
      };
    }>("mtop.idle.search.item", {
      keyword,
      page,
      pageSize,
      sortField: "default",
    });

    const items = (result.data.items || []).map((item) => this.parseItem(item));
    this.scrapedItems.push(...items);

    logger.info(`Found ${items.length} items for "${keyword}"`, { module: "scraper" });
    return items;
  }

  async searchMultiplePages(keyword: string, maxPages = 5): Promise<ScrapedItem[]> {
    const allItems: ScrapedItem[] = [];

    for (let page = 1; page <= maxPages; page++) {
      try {
        const items = await this.searchItems(keyword, page, 20);
        allItems.push(...items);

        if (items.length === 0) {
          logger.info("No more items found, stopping", { module: "scraper", page });
          break;
        }

        await sleep(Math.random() * 3000 + 2000);
      } catch (error) {
        logger.error("Search failed at page", {
          module: "scraper",
          page,
          error: error instanceof Error ? error.message : String(error),
        });
        break;
      }
    }

    return allItems;
  }

  async getMyProductStats(): Promise<{
    totalItems: number;
    totalViews: number;
    totalLikes: number;
    avgPrice: number;
    items: Array<{ itemId: string; title: string; views: number; likes: number; price: number }>;
  }> {
    logger.info("Fetching product statistics", { module: "scraper" });

    const result = await this.client.get<{
      data: {
        items: Array<Record<string, unknown>>;
        totalCount: number;
      };
    }>("mtop.idle.my.items", { page: 1, pageSize: 100 });

    const items = (result.data.items || []).map((item) => ({
      itemId: String(item.itemId || ""),
      title: String(item.title || ""),
      views: Number(item.viewCount || 0),
      likes: Number(item.likeCount || 0),
      price: Number(item.price || 0) / 100,
    }));

    const totalViews = items.reduce((sum, item) => sum + item.views, 0);
    const totalLikes = items.reduce((sum, item) => sum + item.likes, 0);
    const avgPrice = items.length > 0 ? items.reduce((sum, item) => sum + item.price, 0) / items.length : 0;

    return {
      totalItems: items.length,
      totalViews,
      totalLikes,
      avgPrice: Math.round(avgPrice * 100) / 100,
      items,
    };
  }

  analyzeData(items?: ScrapedItem[]): ScrapeStats {
    const data = items || this.scrapedItems;
    if (data.length === 0) {
      return { totalScraped: 0, avgPrice: 0, minPrice: 0, maxPrice: 0, topLocations: [] };
    }

    const prices = data.map((item) => item.price).filter((price) => price > 0);
    const locationCounts = new Map<string, number>();

    for (const item of data) {
      if (item.location) {
        locationCounts.set(item.location, (locationCounts.get(item.location) || 0) + 1);
      }
    }

    const topLocations = Array.from(locationCounts.entries())
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalScraped: data.length,
      avgPrice: prices.length > 0 ? Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100 : 0,
      minPrice: prices.length > 0 ? Math.min(...prices) : 0,
      maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
      topLocations,
    };
  }

  async saveScrapedData(filename?: string): Promise<string> {
    const name = filename || `scraped-${Date.now()}.json`;
    const filePath = path.join(this.dataDir, name);
    await fs.writeFile(filePath, JSON.stringify(this.scrapedItems, null, 2), "utf-8");
    logger.info(`Scraped data saved to ${filePath}`, { module: "scraper" });
    return filePath;
  }

  async exportReport(): Promise<string> {
    const stats = this.analyzeData();
    const report = [
      `# Data Scrape Report`,
      `Generated: ${new Date().toISOString()}`,
      ``,
      `## Summary`,
      `- Total items scraped: ${stats.totalScraped}`,
      `- Average price: ¥${stats.avgPrice.toFixed(2)}`,
      `- Price range: ¥${stats.minPrice.toFixed(2)} - ¥${stats.maxPrice.toFixed(2)}`,
      ``,
      `## Top Locations`,
      ...stats.topLocations.map((loc) => `- ${loc.location}: ${loc.count} items`),
    ].join("\n");

    const filePath = path.join(this.dataDir, `report-${Date.now()}.md`);
    await fs.writeFile(filePath, report, "utf-8");
    return filePath;
  }

  private parseItem(raw: Record<string, unknown>): ScrapedItem {
    return {
      itemId: String(raw.itemId || raw.id || ""),
      title: String(raw.title || ""),
      price: Number(raw.price || 0) / 100,
      sellerId: String(raw.sellerId || raw.userId || ""),
      sellerName: String(raw.sellerName || raw.nick || ""),
      location: String(raw.location || raw.area || ""),
      images: Array.isArray(raw.images) ? raw.images.map(String) : [],
      description: String(raw.desc || raw.description || ""),
      views: Number(raw.viewCount || raw.pv || 0),
      likes: Number(raw.likeCount || raw.collectCount || 0),
      publishedAt: Number(raw.gmtCreate || raw.publishTime || 0),
      scrapedAt: Date.now(),
    };
  }

  clearCache(): void {
    this.scrapedItems = [];
  }
}
