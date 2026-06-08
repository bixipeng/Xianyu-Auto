import { getSign } from "./src/core/sign.js";
import { loadConfig } from "./src/core/config.js";

const config = loadConfig();
console.log("Config loaded:", {
  xSignServiceUrl: config.xSignServiceUrl,
  token: config.token ? config.token.slice(0, 10) + "..." : "empty",
  appKey: config.appKey,
});

const params = {
  api: "mtop.idle.user.info",
  v: "1.0",
  data: {},
  session: {
    token: config.token,
    appKey: config.appKey,
    deviceId: config.deviceId,
  },
};

try {
  const result = await getSign(params, config);
  console.log("Sign result:", JSON.stringify(result, null, 2));
} catch (err) {
  console.error("Error:", err instanceof Error ? err.message : String(err));
}
