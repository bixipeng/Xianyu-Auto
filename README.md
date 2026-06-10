# 闲鱼管家 (XianYu Auto)

基于闲鱼私有 API 逆向的自动化运营管理工具，提供 Web 管理后台，支持自动回复、商品管理、自动擦亮、价格监控、数据抓取和自动发货。

![Dashboard](https://img.shields.io/badge/status-active-green) ![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-blue) ![License](https://img.shields.io/badge/license-MIT-yellow)

## 功能特性

| 功能 | 状态 | 说明 |
|------|------|------|
| Web 管理后台 | ✅ | React + Tailwind 单页应用，实时消息推送 (SSE) |
| 商品管理 | ✅ | 查看、上架、编辑、下架商品，分页浏览 |
| 自动回复买家 | ✅ | 关键词匹配 + 默认回复，ACCS WebSocket 实时消息 |
| 消息持久化 | ✅ | 所有买家消息自动保存到本地 JSON，支持分页查询 |
| 自动擦亮商品 | ✅ | 定时批量刷新商品曝光量 |
| 价格监控 | ✅ | 追踪价格变化，超阈值告警 |
| 数据抓取分析 | ✅ | 搜索抓取、竞品分析、数据统计 |
| 自动发货 | ✅ | 买家付款后自动发送虚拟商品内容 |

## 技术架构

```
┌─────────────────────────────────────────────────────────┐
│                   Web Dashboard (React)                  │
│           Tailwind CSS · Lucide Icons · Vite             │
└──────────────────────────┬──────────────────────────────┘
                           │ REST API + SSE
┌──────────────────────────┴──────────────────────────────┐
│                  Express API Server                       │
│          路由 · CORS · 静态文件 · SSE 推送                 │
└───────┬──────────┬──────────┬──────────┬────────────────┘
        │          │          │          │
┌───────┴───┐ ┌────┴────┐ ┌───┴────┐ ┌───┴──────┐
│  MTOP API │ │  ACCS   │ │  Cron  │ │  Message │
│  Client   │ │WebSocket│ │Scheduler│ │  Store   │
└───────────┘ └─────────┘ └────────┘ └──────────┘
        │          │
        ▼          ▼
   ┌──────────────────────┐
   │   Xianyu (Goofish)   │
   │   h5api.m.goofish.com│
   └──────────────────────┘
```

**后端**：Node.js + TypeScript，Express 5，WebSocket (ws)，Cron 调度，Winston 日志

**前端**：React 18 + TypeScript，Vite 6，Tailwind CSS 3，Lucide React 图标库

**通信**：REST API + SSE 实时消息流，ACCS WebSocket 长连接接收闲鱼消息

## 项目结构

```
xianyu-auto/
├── frontend/                  # React 前端
│   ├── src/
│   │   ├── components/        # 页面组件
│   │   │   ├── Dashboard.tsx  # 仪表盘 - 状态概览
│   │   │   ├── Products.tsx   # 商品管理 - 列表/操作
│   │   │   ├── Messages.tsx   # 消息中心 - 实时消息 + 手动回复
│   │   │   ├── Keywords.tsx   # 关键词规则配置
│   │   │   ├── Deliver.tsx    # 自动发货管理
│   │   │   ├── Settings.tsx   # 系统设置
│   │   │   └── Sidebar.tsx    # 侧边导航栏
│   │   ├── App.tsx            # 根组件 (Hash 路由)
│   │   ├── api.ts             # API 请求封装
│   │   ├── main.tsx           # 入口文件
│   │   └── index.css          # Tailwind 样式
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── package.json
├── src/
│   ├── core/                  # 核心模块
│   │   ├── config.ts          # 配置管理
│   │   ├── auth.ts            # 鉴权管理
│   │   ├── sign.ts            # 签名生成
│   │   ├── client.ts          # MTOP API 客户端 (Token 自动刷新)
│   │   └── websocket.ts       # ACCS WebSocket 消息通道
│   ├── api/
│   │   └── server.ts          # Express API 服务 (REST + SSE)
│   ├── features/              # 功能模块
│   │   ├── product-manager.ts # 商品管理 (上架/擦亮/下架)
│   │   ├── auto-reply.ts      # 自动回复 (关键词匹配)
│   │   ├── message-store.ts   # 消息持久化 (JSON 文件存储)
│   │   ├── price-monitor.ts   # 价格监控
│   │   ├── data-scraper.ts    # 数据抓取
│   │   └── auto-deliver.ts    # 自动发货
│   ├── utils/                 # 工具函数
│   │   ├── logger.ts          # Winston 日志
│   │   ├── json-store.ts      # JSON 文件读写 (写队列串行化)
│   │   ├── crypto.ts          # 加密工具
│   │   └── helpers.ts         # 通用辅助函数
│   ├── scheduler.ts           # Cron 任务调度器
│   └── index.ts               # 主入口
├── data/                      # 运行时数据 (messages.json 等)
├── .env.example               # 配置模板
├── tsconfig.json
└── package.json
```

## 快速开始

### 环境要求

- Node.js >= 20.0.0
- npm >= 10.0.0
- x-sign 签名服务 (需单独部署)

### 1. 克隆并安装

```bash
git clone https://github.com/bixipeng/Xianyu-Auto.git
cd Xianyu-Auto

# 安装后端依赖
npm install

# 安装前端依赖
cd frontend && npm install && cd ..
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，填入认证信息：

```ini
# --- 认证信息 (必填) ---
COOKIE=          # 从浏览器 DevTools Network 面板获取
USER_ID=         # 闲鱼用户 ID
DEVICE_ID=       # 设备 ID (随机生成即可)
TOKEN=           # 认证 Token

# --- 签名服务 ---
XSIGN_SERVICE_URL=http://127.0.0.1:8080

# --- 自动回复 ---
AUTO_REPLY_ENABLED=true
AUTO_REPLY_RULES=[{"keywords":["在吗","你好"],"reply":"您好，请问有什么需要帮忙的吗？"}]
DEFAULT_REPLY=亲，稍等一下，我会尽快回复您~

# --- 自动擦亮 ---
AUTO_POLISH_ENABLED=true
POLISH_INTERVAL_HOURS=8

# --- 价格监控 ---
PRICE_MONITOR_ENABLED=false

# --- 自动发货 ---
AUTO_DELIVER_ENABLED=false
DELIVER_RULES=[]
```

> **获取 Cookie 的方法：** 在浏览器登录 [闲鱼网页版](https://www.goofish.com)，打开开发者工具 → Network → 刷新页面 → 点击任意请求 → 复制 Request Headers 中的 `Cookie` 值。

### 3. 部署签名服务

闲鱼的 `x-sign` 签名算法较复杂，需要部署独立的签名服务。推荐方案：

- [cv-cat/XianYuApis](https://github.com/cv-cat/XianYuApis) — JavaScript 签名实现

部署后确保 `XSIGN_SERVICE_URL` 指向签名服务地址。

### 4. 构建并运行

```bash
# 构建前端
cd frontend && npm run build && cd ..

# 构建后端
npm run build

# 启动 (生产模式)
npm start
```

启动后访问 `http://localhost:3000` 即可打开 Web 管理后台。

### 开发模式

```bash
# 终端 1: 启动后端 (热重载)
npm run dev

# 终端 2: 启动前端 (热重载，默认端口 5173)
cd frontend && npm run dev
```

开发模式下前端通过 Vite proxy 转发 API 请求到后端。

## API 接口

后端启动后提供以下 REST API：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/status` | 系统状态 (WebSocket 连接、功能开关等) |
| GET | `/api/products` | 商品列表 (支持分页 `page` + `pageSize`) |
| POST | `/api/products/:id/polish` | 擦亮商品 |
| POST | `/api/products/:id/offline` | 下架商品 |
| GET | `/api/messages` | 消息列表 (支持 `limit` + `offset` 分页) |
| GET | `/api/messages/sessions` | 会话列表 (按买家分组) |
| GET | `/api/messages/session/:id` | 某个会话的消息详情 |
| POST | `/api/messages/reply` | 手动回复买家消息 |
| GET | `/api/keywords` | 获取关键词回复规则 |
| PUT | `/api/keywords` | 更新关键词规则 |
| GET | `/api/config` | 获取当前配置 |
| PUT | `/api/config` | 更新配置项 |
| GET | `/api/events` | SSE 事件流 (实时推送买家消息) |

## 页面路由

前端使用 Hash 路由，支持 URL 直接访问：

| URL | 页面 |
|-----|------|
| `/#dashboard` | 仪表盘 |
| `/#products` | 商品管理 |
| `/#messages` | 消息中心 |
| `/#keywords` | 关键词规则 |
| `/#deliver` | 自动发货 |
| `/#settings` | 系统设置 |

## 服务器部署

### systemd 服务

```ini
[Unit]
Description=XianYu Auto Service
After=network.target

[Service]
Type=simple
User=deploy
WorkingDirectory=/opt/xianyu-auto
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable xianyu-auto
sudo systemctl start xianyu-auto
```

### Docker 部署

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist/ ./dist/
COPY frontend/dist/ ./frontend/dist/
COPY .env ./
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

```bash
docker build -t xianyu-auto .
docker run -d --name xianyu-auto -p 3000:3000 --env-file .env -v ./data:/app/data xianyu-auto
```

### Nginx 反向代理

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;

        # SSE 支持
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
    }
}
```

## 常见问题

**Q: 商品列表显示 `FAIL_BIZ_FORBIDDEN`？**

闲鱼 API 限制每页最多 20 条商品，前端已默认 `pageSize=20`。如果仍然报错，检查 Cookie 是否过期。

**Q: 消息页面没有历史消息？**

ACCS 协议不支持拉取历史消息。消息持久化从服务启动时开始，之后的所有买家消息都会自动保存。重启服务不会丢失已保存的消息。

**Q: WebSocket 连接断开后不会自动重连？**

已内置自动重连机制，断线后指数退避重试。如果频繁断连，检查网络稳定性或 Cookie 是否过期。

**Q: Cookie 多久过期？**

通常 24 小时左右。建议定期检查服务日志，Cookie 过期后需要重新获取。

## 注意事项

- 本工具仅供学习研究使用，请勿用于商业用途
- 闲鱼 API 可能随时变更，签名算法需要持续关注
- 建议控制请求频率，避免账号被风控
- Cookie 有效期约 24 小时，需要定期更新
- 自动回复规则建议合理设置，避免被识别为机器人

## 致谢

- [cv-cat/XianYuApis](https://github.com/cv-cat/XianYuApis) — 签名算法参考

## License

MIT
