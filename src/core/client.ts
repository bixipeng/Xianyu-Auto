import axios, { type AxiosInstance, type AxiosRequestConfig } from "axios";
import crypto from "node:crypto";
import type { AppConfig } from "./config.js";
import type { AuthSession } from "./auth.js";
import { getSign, type SignParams } from "./sign.js";
import { logger } from "../utils/logger.js";
import { sleep, retry } from "../utils/helpers.js";

export class XianyuClient {
  private http: AxiosInstance;
  private config: AppConfig;
  private session: AuthSession;
  private mtopToken: string = "";

  constructor(config: AppConfig, session: AuthSession) {
    this.config = config;
    this.session = session;

    // Extract initial token from cookie
    this.mtopToken = this.extractMtopToken(session.cookie);

    this.http = axios.create({
      baseURL: config.apiBaseUrl,
      timeout: 15000,
      maxRedirects: 5,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://www.goofish.com/",
        "Origin": "https://www.goofish.com",
        Cookie: session.cookie,
      },
    });

    this.http.interceptors.request.use(async (reqConfig) => {
      await sleep(Math.random() * 500 + 200);
      return reqConfig;
    });

    // Response interceptor to capture new tokens
    this.http.interceptors.response.use((response) => {
      const setCookies = response.headers["set-cookie"];
      if (setCookies) {
        let newCookie = this.http.defaults.headers.Cookie as string;
        let tokenUpdated = false;

        for (const cookie of setCookies) {
          // Update _m_h5_tk
          const tkMatch = cookie.match(/_m_h5_tk=([^;]+)/);
          if (tkMatch && !cookie.includes("_m_h5_tk_enc")) {
            const newFullToken = tkMatch[1];
            const newToken = newFullToken.split("_")[0];
            if (newToken && newToken !== this.mtopToken) {
              this.mtopToken = newToken;
              // Update cookie string with new token
              newCookie = newCookie.replace(/_m_h5_tk=[^;]+/, `_m_h5_tk=${newFullToken}`);
              this.http.defaults.headers.Cookie = newCookie;
              tokenUpdated = true;
            }
          }
          // Update _m_h5_tk_enc too
          const encMatch = cookie.match(/_m_h5_tk_enc=([^;]+)/);
          if (encMatch) {
            newCookie = newCookie.replace(/_m_h5_tk_enc=[^;]+/, `_m_h5_tk_enc=${encMatch[1]}`);
            this.http.defaults.headers.Cookie = newCookie;
          }
        }

        if (tokenUpdated) {
          logger.info("MTOP token refreshed", { module: "client" });
        }
      }
      return response;
    });
  }

  private extractMtopToken(cookie: string): string {
    const match = cookie.match(/_m_h5_tk=([^;]+)/);
    return match ? match[1].split("_")[0] : "";
  }

  private computeMtopSign(data: string): string {
    const timestamp = Date.now().toString();
    const raw = `${this.mtopToken}&${timestamp}&${this.session.appKey}&${data}`;
    const sign = crypto.createHash("md5").update(raw).digest("hex");
    return sign;
  }

  async request<T = unknown>(api: string, data: Record<string, unknown>, options?: AxiosRequestConfig): Promise<T> {
    return retry(
      async () => {
        const timestamp = Date.now().toString();
        const dataStr = JSON.stringify(data);

        // Compute MTOP sign locally using the (possibly refreshed) token
        const sign = this.computeMtopSign(dataStr);

        // Also get x-sign headers from sign service
        let signHeaders: Record<string, string> = {};
        try {
          const signParams: SignParams = {
            api,
            v: "1.0",
            data,
            session: {
              token: this.mtopToken || this.session.token,
              appKey: this.session.appKey,
              deviceId: this.session.deviceId,
            },
          };
          const signResult = await getSign(signParams, this.config);
          signHeaders = {
            "x-sign": signResult["x-sign"],
            "x-mini-wua": signResult["x-mini-wua"],
            "x-umt": signResult["x-umt"],
            "x-sgext": signResult["x-sgext"],
          };
        } catch {
          logger.warn("Sign service unavailable, proceeding without sign headers", { module: "client" });
        }

        const response = await this.http.get<T>(`/h5/${api}/1.0/`, {
          params: {
            jsv: "2.7.2",
            appKey: this.session.appKey,
            t: timestamp,
            sign,
            api,
            v: "1.0",
            type: "originaljson",
            dataType: "json",
            data: dataStr,
          },
          headers: {
            ...signHeaders,
            ...options?.headers,
          },
        });

        const responseData = response.data as Record<string, unknown>;
        if (responseData?.ret && Array.isArray(responseData.ret)) {
          const retCode = String(responseData.ret[0] || "");

          // Auto-retry on token expiry
          if (retCode.includes("TOKEN_EXOIRED") || retCode.includes("TOKEN_EXPIRED")) {
            logger.info("Token expired, refreshing and retrying...", { module: "client" });
            // The response interceptor already captured the new token from Set-Cookie
            // Recompute sign with new token and retry
            const newTimestamp = Date.now().toString();
            const newSign = this.computeMtopSign(dataStr);

            const retryResponse = await this.http.get<T>(`/h5/${api}/1.0/`, {
              params: {
                jsv: "2.7.2",
                appKey: this.session.appKey,
                t: newTimestamp,
                sign: newSign,
                api,
                v: "1.0",
                type: "originaljson",
                dataType: "json",
                data: dataStr,
              },
              headers: {
                ...signHeaders,
                ...options?.headers,
              },
            });

            const retryData = retryResponse.data as Record<string, unknown>;
            if (retryData?.ret && Array.isArray(retryData.ret)) {
              const retryCode = String(retryData.ret[0] || "");
              if (retryCode.startsWith("FAIL")) {
                throw new Error(`API error: ${retryCode}`);
              }
            }
            return retryResponse.data;
          }

          if (retCode.startsWith("FAIL")) {
            throw new Error(`API error: ${retCode}`);
          }
        }

        return response.data;
      },
      { maxRetries: 3, delay: 2000, backoff: 2 }
    );
  }

  async get<T = unknown>(api: string, params?: Record<string, unknown>): Promise<T> {
    return this.request<T>(api, params || {});
  }

  async post<T = unknown>(api: string, data: Record<string, unknown>): Promise<T> {
    return this.request<T>(api, data);
  }

  updateSession(session: AuthSession): void {
    this.session = session;
    this.http.defaults.headers.Cookie = session.cookie;
  }

  getSession(): AuthSession {
    return this.session;
  }
}
