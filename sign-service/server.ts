import http from "node:http";
import crypto from "node:crypto";

const PORT = parseInt(process.env.PORT || "8080", 10);
const HOST = process.env.HOST || "127.0.0.1";

// MTOP appKey for Xianyu
const MTOP_APP_KEY = "34839810";

interface SignRequest {
  api: string;
  v?: string;
  data: string;
  token: string;
  appKey: string;
  deviceId: string;
  timestamp: number;
  nonce: string;
}

interface SignResponse {
  "x-sign": string;
  "x-mini-wua": string;
  "x-umt": string;
  "x-sgext": string;
  "x-features": string;
  "x-app-ver": string;
  sign: string;
}

/**
 * Generate MTOP sign (MD5 hash)
 * Format: MD5(token + "&" + timestamp + "&" + appKey + "&" + data)
 */
function generateMtopSign(token: string, timestamp: string, appKey: string, data: string): string {
  const raw = `${token}&${timestamp}&${appKey}&${data}`;
  return crypto.createHash("md5").update(raw).digest("hex");
}

/**
 * Generate x-sign using the SG algorithm simulation
 * This is a simplified version - for production use, the actual SG module is needed
 */
function generateXSign(params: SignRequest): string {
  // Build the signing string
  const signStr = [
    params.api,
    params.v || "1.0",
    params.timestamp.toString(),
    params.nonce,
    params.token,
    params.appKey,
    params.data,
  ].join("&");

  return crypto.createHash("md5").update(signStr).digest("hex");
}

/**
 * Generate x-mini-wua
 */
function generateMiniWua(params: SignRequest): string {
  const raw = `${params.deviceId}&${params.token}&${params.timestamp}&${params.data}`;
  return crypto.createHash("md5").update(raw).digest("hex");
}

/**
 * Handle sign request
 */
function handleSign(body: SignRequest): SignResponse {
  const timestamp = body.timestamp?.toString() || Date.now().toString();
  const appKey = body.appKey || MTOP_APP_KEY;

  // Generate MTOP sign
  const sign = generateMtopSign(body.token || "", timestamp, appKey, body.data || "{}");

  // Generate x-sign headers
  const xSign = generateXSign(body);
  const xMiniWua = generateMiniWua(body);

  return {
    sign,
    "x-sign": xSign,
    "x-mini-wua": xMiniWua,
    "x-umt": body.token || "",
    "x-sgext": "",
    "x-features": "1",
    "x-app-ver": "1.0",
  };
}

// Create HTTP server
const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.method === "GET" && (req.url === "/" || req.url === "/health")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "xianyu-sign-service", version: "1.0.0" }));
    return;
  }

  // Sign endpoint
  if (req.method === "POST" && req.url === "/sign") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        const params = JSON.parse(body) as SignRequest;
        const result = handleSign(params);

        console.log(`[SIGN] api=${params.api} timestamp=${params.timestamp} sign=${result.sign}`);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (error) {
        console.error("[ERROR] Failed to process sign request:", error);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid request", detail: String(error) }));
      }
    });
    return;
  }

  // 404 for other routes
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, HOST, () => {
  console.log(`\n🐟 XianYu Sign Service`);
  console.log(`   Listening on http://${HOST}:${PORT}`);
  console.log(`   Sign endpoint: POST http://${HOST}:${PORT}/sign`);
  console.log(`   Health check:  GET  http://${HOST}:${PORT}/health\n`);
});
