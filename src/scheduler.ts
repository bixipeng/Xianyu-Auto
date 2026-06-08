import { CronJob } from "cron";
import { logger } from "./utils/logger.js";
import type { ProductManager } from "./features/product-manager.js";
import type { PriceMonitor } from "./features/price-monitor.js";
import type { DataScraper } from "./features/data-scraper.js";

export interface SchedulerOptions {
  polishEnabled: boolean;
  polishIntervalHours: number;
  priceMonitorEnabled: boolean;
  priceCheckIntervalMinutes: number;
  dataScrapeEnabled: boolean;
  scrapeIntervalHours: number;
}

export class TaskScheduler {
  private jobs: CronJob[] = [];
  private productManager: ProductManager;
  private priceMonitor: PriceMonitor;
  private dataScraper: DataScraper;
  private options: SchedulerOptions;

  constructor(
    productManager: ProductManager,
    priceMonitor: PriceMonitor,
    dataScraper: DataScraper,
    options: SchedulerOptions
  ) {
    this.productManager = productManager;
    this.priceMonitor = priceMonitor;
    this.dataScraper = dataScraper;
    this.options = options;
  }

  start(): void {
    logger.info("Starting task scheduler", { module: "scheduler" });

    if (this.options.polishEnabled) {
      this.schedulePolish();
    }

    if (this.options.priceMonitorEnabled) {
      this.schedulePriceCheck();
    }

    if (this.options.dataScrapeEnabled) {
      this.scheduleDataScrape();
    }

    logger.info(`Scheduler started with ${this.jobs.length} tasks`, { module: "scheduler" });
  }

  private schedulePolish(): void {
    const hours = this.options.polishIntervalHours;
    const job = new CronJob(
      `0 0 */${hours} * * *`,
      async () => {
        logger.info("Running scheduled polish", { module: "scheduler" });
        try {
          const count = await this.productManager.polishAllProducts();
          logger.info(`Polished ${count} products`, { module: "scheduler" });
        } catch (error) {
          logger.error("Polish task failed", {
            module: "scheduler",
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
      null,
      false,
      "Asia/Shanghai"
    );

    job.start();
    this.jobs.push(job);
    logger.info(`Polish task scheduled: every ${hours} hours`, { module: "scheduler" });
  }

  private schedulePriceCheck(): void {
    const minutes = this.options.priceCheckIntervalMinutes;
    const job = new CronJob(
      `*/${minutes} * * * *`,
      async () => {
        logger.info("Running scheduled price check", { module: "scheduler" });
        try {
          await this.priceMonitor.checkAllMyProducts();
        } catch (error) {
          logger.error("Price check task failed", {
            module: "scheduler",
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
      null,
      false,
      "Asia/Shanghai"
    );

    job.start();
    this.jobs.push(job);
    logger.info(`Price check scheduled: every ${minutes} minutes`, { module: "scheduler" });
  }

  private scheduleDataScrape(): void {
    const hours = this.options.scrapeIntervalHours;
    const job = new CronJob(
      `0 0 */${hours} * * *`,
      async () => {
        logger.info("Running scheduled data scrape", { module: "scheduler" });
        try {
          const stats = await this.dataScraper.getMyProductStats();
          logger.info("Product stats updated", {
            module: "scheduler",
            totalItems: stats.totalItems,
            totalViews: stats.totalViews,
          });
        } catch (error) {
          logger.error("Data scrape task failed", {
            module: "scheduler",
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
      null,
      false,
      "Asia/Shanghai"
    );

    job.start();
    this.jobs.push(job);
    logger.info(`Data scrape scheduled: every ${hours} hours`, { module: "scheduler" });
  }

  stop(): void {
    for (const job of this.jobs) {
      job.stop();
    }
    this.jobs = [];
    logger.info("Scheduler stopped", { module: "scheduler" });
  }

  getActiveJobs(): number {
    return this.jobs.length;
  }
}
