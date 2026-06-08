# 闲鱼自动化 (XianYu Auto)

基于逆向闲鱼私有 API 的自动化工具，支持自动上架、自动回复、自动擦亮、价格监控、数据抓取和自动发货。

## 功能特性

| 功能 | 状态 | 说明 |
|------|------|------|
| 自动上架商品 | ✅ | 支持批量上架、编辑、下架商品 |
| 自动回复买家 | ✅ | 关键词匹配 + 默认回复，支持 WebSocket 实时消息 |
| 自动擦亮商品 | ✅ | 定时批量刷新商品曝光 |
| 价格监控 | ✅ | 追踪价格变化，超阈值告警 |
| 数据抓取分析 | ✅ | 搜索抓取、竞品分析、数据统计 |
| 自动发货 | ✅ | 买家付款后自动发送虚拟商品内容 |

## 技术栈

- **Node.js** + **TypeScript**
- **WebSocket** 实时消息通道
- **Cron** 定时任务调度
- **Winston** 日志管理
- **Axios** HTTP 客户端

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填入认证信息：

```bash
cp .env.example .env
```

**关键配置说明：**

- `COOKIE`: 从浏览器开发者工具 Network 面板获取
- `USER_ID`: 你的闲鱼用户 ID
- `TOKEN`: 认证 Token
- `XSIGN_SERVICE_URL`: x-sign 签名服务地址 (需要单独部署)

### 3. 部署签名服务

闲鱼的 `x-sign` 签名算法较复杂，需要部署独立的签名服务。推荐参考：

- [cv-cat/XianYuApis](https://github.com/cv-cat/XianYuApis) - JavaScript 签名实现

### 4. 运行

```bash
# 开发模式
npm run dev

# 生产模式
npm run build
npm start
```

## 项目结构

```
xianyu-auto/
├── src/
│   ├── core/           # 核心模块
│   │   ├── config.ts   # 配置管理
│   │   ├── auth.ts     # 鉴权管理
│   │   ├── sign.ts     # 签名生成
│   │   ├── client.ts   # API 客户端
│   │   └── websocket.ts # WebSocket 消息通道
│   ├── features/       # 功能模块
│   │   ├── product-manager.ts  # 商品管理 (上架/擦亮)
│   │   ├── auto-reply.ts       # 自动回复
│   │   ├── price-monitor.ts    # 价格监控
│   │   ├── data-scraper.ts     # 数据抓取
│   │   └── auto-deliver.ts     # 自动发货
│   ├── utils/          # 工具函数
│   ├── scheduler.ts    # 任务调度器
│   └── index.ts        # 主入口
├── data/               # 数据存储
├── .env.example        # 配置模板
└── package.json
```

## 云服务器部署

### systemd 服务

创建 `/etc/systemd/system/xianyu-auto.service`：

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
COPY .env ./
CMD ["node", "dist/index.js"]
```

## 注意事项

- 本工具仅供学习研究使用，请勿用于商业用途
- 闲鱼 API 可能随时变更，需要持续关注签名算法更新
- 建议控制请求频率，避免账号被风控
- Cookie 有效期通常为 24 小时，需要定期更新

## License

MIT
