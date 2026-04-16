# MarkLike - 文学切片阅读平台

精品古籍中英对照阅读应用，基于大模型翻译，支持滑动切换阅读体验。

## 项目结构

```
marklike/
├── backend/          # Node.js 后端 API
├── public/          # 前端页面
└── marklike-frontend/  # 旧版前端
```

## 技术栈

- **后端**: Node.js + Express + MySQL
- **前端**: 原生 HTML/CSS/JS
- **翻译**: Kimi API (大模型翻译)

## 快速开始

```bash
# 后端
cd backend
npm install
npm start

# 访问
http://localhost:3011
```

## 功能

- 精品古籍内容展示
- 中英文对照翻译
- 三语对照（原文/白话/英文）
- 滑动切换阅读

## 部署

- 服务器: 腾讯云轻量
- API: http://43.128.101.103:3011
- 前端: http://43.128.101.103
