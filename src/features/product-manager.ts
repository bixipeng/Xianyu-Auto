import type { XianyuClient } from "../core/client.js";
import { logger } from "../utils/logger.js";
import { sleep } from "../utils/helpers.js";
import { JsonFileStore } from "../utils/json-store.js";
import fs from "node:fs/promises";
import path from "node:path";

export interface ProductInfo {
  title: string;
  description: string;
  price: number;
  originalPrice?: number;
  images: string[];
  categoryId: string;
  location?: string;
  stock?: number;
  deliveryFee?: number;
}

export interface ListedProduct extends ProductInfo {
  itemId: string;
  status: "online" | "offline" | "sold";
  listedAt: number;
  views?: number;
  likes?: number;
}

export class ProductManager {
  private client: XianyuClient;
  private dataDir: string;

  constructor(client: XianyuClient, dataDir: string) {
    this.client = client;
    this.dataDir = dataDir;
  }

  async listProduct(product: ProductInfo): Promise<ListedProduct> {
    logger.info("Listing new product", { module: "product", title: product.title });

    const imageUrls = await this.uploadImages(product.images);

    const result = await this.client.post<{ data: { itemId: string } }>("mtop.idle.item.publish", {
      title: product.title,
      desc: product.description,
      price: Math.round(product.price * 100),
      originalPrice: product.originalPrice ? Math.round(product.originalPrice * 100) : undefined,
      images: imageUrls,
      catId: product.categoryId,
      location: product.location || "",
      stock: product.stock || 1,
      deliveryFee: product.deliveryFee ? Math.round(product.deliveryFee * 100) : 0,
    });

    const itemId = result.data.itemId;
    const listedProduct: ListedProduct = {
      ...product,
      itemId,
      status: "online",
      listedAt: Date.now(),
    };

    await this.saveProductData(listedProduct);
    logger.info("Product listed successfully", { module: "product", itemId });

    return listedProduct;
  }

  async editProduct(itemId: string, updates: Partial<ProductInfo>): Promise<void> {
    logger.info("Editing product", { module: "product", itemId });

    const data: Record<string, unknown> = { itemId };
    if (updates.title) data.title = updates.title;
    if (updates.description) data.desc = updates.description;
    if (updates.price !== undefined) data.price = Math.round(updates.price * 100);
    if (updates.images) data.images = await this.uploadImages(updates.images);

    await this.client.post("mtop.idle.item.edit", data);
    logger.info("Product edited", { module: "product", itemId });
  }

  async offlineProduct(itemId: string): Promise<void> {
    logger.info("Taking product offline", { module: "product", itemId });
    await this.client.post("mtop.idle.item.offline", { itemId });
  }

  async deleteProduct(itemId: string): Promise<void> {
    logger.info("Deleting product", { module: "product", itemId });
    await this.client.post("mtop.idle.item.delete", { itemId });
  }

  async getMyProducts(page = 1, pageSize = 20): Promise<ListedProduct[]> {
    logger.debug("Fetching my products", { module: "product", page });

    const userId = this.client.getSession().userId;
    const result = await this.client.post<{
      data: {
        cardList: Array<Record<string, unknown>>;
        totalCount: string;
        nextPage: string;
        itemTopicList: unknown[];
        serverTime: string;
      };
    }>("mtop.idle.web.xyh.item.list", {
      userId,
      pageNumber: page,
      pageSize,
      scene: "seller_home",
    });

    const cardList = result?.data?.cardList || [];
    return cardList.map((card) => {
      // Actual structure: { cardData: { title, id, categoryId, itemStatus, picInfo, priceInfo, detailParams }, cardType }
      const cardData = (card.cardData || card) as Record<string, unknown>;
      const detailParams = (cardData.detailParams || {}) as Record<string, unknown>;
      const priceInfo = (cardData.priceInfo || {}) as Record<string, unknown>;
      const picInfo = (cardData.picInfo || {}) as Record<string, unknown>;

      // Extract itemId from cardData.id or detailParams.itemId
      const itemId = String(cardData.id || detailParams.itemId || "");

      // Extract title
      const title = String(cardData.title || detailParams.title || "");

      // Extract price — priceInfo.price is in yuan (not fen), no need to divide by 100
      const priceStr = String(priceInfo.price || detailParams.soldPrice || "0");
      const price = Number(priceStr);

      // Extract images
      const images: string[] = [];
      const mainPicUrl = String(picInfo.picUrl || detailParams.picUrl || "");
      if (mainPicUrl) images.push(mainPicUrl);

      // Parse imageInfos JSON array from detailParams for additional images
      if (typeof detailParams.imageInfos === "string") {
        try {
          const imageInfos = JSON.parse(detailParams.imageInfos) as Array<Record<string, unknown>>;
          for (const img of imageInfos) {
            if (img.url) images.push(String(img.url));
          }
        } catch { /* ignore parse errors */ }
      }

      // Deduplicate images
      const uniqueImages = [...new Set(images)];

      // Parse status: itemStatus=0 means online
      const itemStatus = Number(cardData.itemStatus ?? -1);

      // Parse "X人想要" from label data for likes count
      let likes = 0;
      try {
        const labelData = ((cardData.itemLabelDataVO as Record<string, unknown>)?.labelData as Record<string, unknown>) || {};
        for (const pos of Object.values(labelData)) {
          const tagList = ((pos as Record<string, unknown>)?.tagList as Array<Record<string, unknown>>) || [];
          for (const tag of tagList) {
            const content = String(((tag as Record<string, unknown>)?.data as Record<string, unknown>)?.content || "");
            const match = content.match(/(\d+)人想要/);
            if (match) likes = parseInt(match[1], 10);
          }
        }
      } catch { /* ignore */ }

      return {
        title,
        description: "",
        price,
        images: uniqueImages,
        categoryId: String(cardData.categoryId || ""),
        itemId,
        status: this.parseStatus(String(itemStatus)),
        listedAt: Date.now(),
        views: 0,
        likes,
      };
    });
  }

  async polishProduct(itemId: string): Promise<void> {
    logger.info("Polishing (refreshing) product", { module: "product", itemId });
    await this.client.post("mtop.idle.item.polish", { itemId });
    logger.info("Product polished", { module: "product", itemId });
  }

  async polishAllProducts(): Promise<number> {
    logger.info("Starting batch polish", { module: "product" });
    const products = await this.getMyProducts(1, 100);
    const onlineProducts = products.filter((product) => product.status === "online");
    let polishedCount = 0;

    for (const product of onlineProducts) {
      try {
        await this.polishProduct(product.itemId);
        polishedCount++;
        await sleep(Math.random() * 3000 + 2000);
      } catch (error) {
        logger.error("Failed to polish product", {
          module: "product",
          itemId: product.itemId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info(`Batch polish complete: ${polishedCount}/${onlineProducts.length}`, { module: "product" });
    return polishedCount;
  }

  async getProductDetail(itemId: string): Promise<Record<string, unknown> | null> {
    try {
      const result = await this.client.post<{ data: Record<string, unknown> }>("mtop.taobao.idle.pc.detail", {
        itemId,
      });
      return result.data;
    } catch (error) {
      logger.error("Failed to get product detail", {
        module: "product",
        itemId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private async uploadImages(imagePaths: string[]): Promise<string[]> {
    const urls: string[] = [];
    for (const imagePath of imagePaths) {
      try {
        if (imagePath.startsWith("http")) {
          urls.push(imagePath);
          continue;
        }
        const imageBuffer = await fs.readFile(imagePath);
        const base64 = imageBuffer.toString("base64");
        const result = await this.client.post<{ data: { url: string } }>("mtop.idle.image.upload", {
          image: base64,
          name: path.basename(imagePath),
        });
        urls.push(result.data.url);
        await sleep(500);
      } catch (error) {
        logger.warn("Failed to upload image", {
          module: "product",
          path: imagePath,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return urls;
  }

  private parseStatus(status: string): "online" | "offline" | "sold" {
    switch (status) {
      case "0":
      case "online":
        return "online";
      case "1":
      case "sold":
        return "sold";
      default:
        return "offline";
    }
  }

  private async saveProductData(product: ListedProduct): Promise<void> {
    const filePath = path.join(this.dataDir, "products.json");
    await JsonFileStore.update<ListedProduct[]>(
      filePath,
      (products) => {
        const index = products.findIndex((p) => p.itemId === product.itemId);
        if (index >= 0) {
          products[index] = product;
        } else {
          products.push(product);
        }
        return products;
      },
      []
    );
  }
}
