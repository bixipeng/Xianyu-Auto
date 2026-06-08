import axios, { type AxiosInstance, type AxiosRequestConfig } from "axios";
import type { AppConfig } from "./config.js";
import type { AuthSession } from "./auth.js";
import { getSign, type SignParams } from "./sign.js";
import { logger } from "../utils/logger.js";
import { sleep, retry } from "../utils/helpers.js";

export class XianyuClient {
  private http: AxiosInstance;
  private config: AppConfig;
  private session: AuthSession;

  constructor(config: AppConfig, session: AuthSession) {
    this.config = config;
    this.session = session;

    this.http = axios.create({
      baseURL: config.apiBaseUrl,
      timeout: 15000,
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
        "Referer": "https://market.m.taobao.com/",
        "Origin": "https://market.m.taobao.com",
        Cookie: session.cookie,
      },
    });

    this.http.interceptors.request.use(async (reqConfig) => {
      await sleep(Math.random() * 500 + 200);
      return reqConfig;
    });
  }

  async request<T = unknown>(api: string, data: Record<string, unknown>, options?: AxiosRequestConfig): Promise<T> {
    return retry(
      async () => {
        const timestamp = Math.floor(Date.now() / 1000).toString();

        const signParams: SignParams = {
          api,
          v: options?.params?.v || "1.0",
          data,
          session: {
            token: this.session.token,
            appKey: this.session.appKey,
            deviceId: this.session.deviceId,
          },
        };

        let signHeaders: Record<string, string> = {};
        try {
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
            sign: "",
            api,
            v: "1.0",
            type: "originaljson",
            dataType: "json",
            data: JSON.stringify(data),
          },
          headers: {
            ...signHeaders,
            ...options?.headers,
          },
        });

        const responseData = response.data as Record<string, unknown>;
        if (responseData?.ret && Array.isArray(responseData.ret)) {
          const retCode = String(responseData.ret[0] || "");
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
