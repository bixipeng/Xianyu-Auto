import axios from "axios";
import { config } from "dotenv";
import crypto from "node:crypto";

config();

const COOKIE = process.env.COOKIE || "";
const TOKEN = process.env.TOKEN || "";
const APP_KEY = process.env.APP_KEY || "34839810";

async function testCookie(): Promise<void> {
  console.log("=== 闲鱼 Cookie 有效性测试 ===\n");

  const h5tkMatch = COOKIE.match(/_m_h5_tk=([^;]+)/);
  const unbMatch = COOKIE.match(/unb=([^;]+)/);
  const tracknickMatch = COOKIE.match(/tracknick=([^;]+)/);

  console.log("Cookie 解析结果:");
  console.log(`  用户 ID (unb): ${unbMatch?.[1] || "未找到"}`);
  console.log(`  昵称 (tracknick): ${tracknickMatch?.[1] || "未找到"}`);
  console.log(`  _m_h5_tk: ${h5tkMatch?.[1] || "未找到"}`);
  console.log();

  const timestamp = Date.now().toString();
  const signData = `${TOKEN}&${timestamp}&${APP_KEY}&${JSON.stringify({})}`;
  const sign = crypto.createHash("md5").update(signData).digest("hex");

  console.log("正在调用闲鱼 API 测试...\n");

  try {
    const response = await axios.get("https://h5api.m.goofish.com/h5/mtop.idle.user.info/1.0/", {
      params: {
        jsv: "2.7.2",
        appKey: APP_KEY,
        t: timestamp,
        sign,
        api: "mtop.idle.user.info",
        v: "1.0",
        type: "originaljson",
        dataType: "json",
        data: JSON.stringify({}),
      },
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
        "Referer": "https://market.m.taobao.com/",
        "Origin": "https://market.m.taobao.com",
        Cookie: COOKIE,
      },
      timeout: 15000,
    });

    const data = response.data as Record<string, unknown>;
    const ret = data.ret as string[] | undefined;

    if (ret && ret.some((r) => r.includes("SUCCESS"))) {
      console.log("✅ Cookie 有效！\n");
      console.log("API 返回数据:", JSON.stringify(data, null, 2));
    } else if (ret && ret.some((r) => r.includes("TOKEN_EMPTY"))) {
      console.log("⚠️ Token 为空，但 Cookie 基本可用");
      console.log("返回:", ret);
    } else if (ret && ret.some((r) => r.includes("SESSION_EXPIRED"))) {
      console.log("❌ Cookie 已过期，请重新获取");
    } else {
      console.log("⚠️ API 返回异常:");
      console.log("返回:", ret);
      console.log("完整响应:", JSON.stringify(data, null, 2));
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const data = error.response?.data;

      if (status === 403 || status === 401) {
        console.log("❌ Cookie 无效或已过期 (HTTP", status + ")");
      } else if (data) {
        const ret = (data as Record<string, unknown>).ret as string[] | undefined;
        if (ret && ret.some((r) => r.includes("SESSION_EXPIRED") || r.includes("FAIL_SYS"))) {
          console.log("❌ Cookie 已过期");
          console.log("返回:", ret);
        } else {
          console.log("⚠️ 请求异常:", status, JSON.stringify(data, null, 2));
        }
      } else {
        console.log("❌ 网络错误:", error.message);
      }
    } else {
      console.log("❌ 未知错误:", String(error));
    }
  }

  try {
    const response = await axios.get("https://www.goofish.com/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Cookie: COOKIE,
      },
      timeout: 10000,
      maxRedirects: 0,
      validateStatus: () => true,
    });

    console.log("\n--- 网页访问测试 ---");
    console.log(`  HTTP 状态: ${response.status}`);

    if (response.status === 200 || response.status === 302) {
      console.log("  ✅ 网页可正常访问");
    } else {
      console.log("  ⚠️ 网页访问异常");
    }
  } catch (error) {
    console.log("\n--- 网页访问测试 ---");
    console.log("  ⚠️ 网页访问失败:", axios.isAxiosError(error) ? error.message : String(error));
  }
}

testCookie().catch((error) => {
  console.error("测试脚本错误:", error);
});
