import crypto from "node:crypto";

/**
 * 生成 AppKey
 */
export function generateAppKey(): string {
  return "34839810";
}

/**
 * 生成请求签名 (MD5-based)
 * 闲鱼使用 token + "&" + timestamp + "&" + appKey 的 MD5 作为 ecode
 */
export function generateEcode(token: string, timestamp: number, appKey: string): string {
  const raw = `${token}&${timestamp}&${appKey}`;
  return crypto.createHash("md5").update(raw).digest("hex");
}

/**
 * 生成 _sign 签名
 * 简化版本 - 实际需要对接 x-sign 算法服务
 */
export function generateSign(data: string): string {
  return crypto.createHash("md5").update(data).digest("hex");
}

/**
 * 生成设备指纹 (简化版)
 */
export function generateDeviceId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/**
 * 生成随机字符串
 */
export function randomString(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 获取当前时间戳(秒)
 */
export function getTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * 获取当前时间戳(毫秒)
 */
export function getTimestampMs(): number {
  return Date.now();
}
