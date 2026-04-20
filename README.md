# EchoCare（回声）Monorepo

pnpm + Turborepo + Expo（双端）+ Node API + Supabase 占位目录。

## 结构

| 路径 | 说明 |
|------|------|
| `apps/echo-senio` | 老人端（极简语音 + 大字卡 UI 占位） |
| `apps/echo-family` | 子女端（中枢 / 配置 UI 占位） |
| `packages/shared` | 共享类型与 Realtime 命名等 |
| `services/api` | Node 网关占位（健康检查、echo 接口） |
| `supabase/` | 文档与后续 migrations |

## 环境要求

- Node 20+
- 若本机未全局安装 pnpm，可用：`npx pnpm@9 install`（在仓库根目录执行）

## 安装

```bash
cd C:\Users\15483\Projects\echocare
npx pnpm@9 install
```

## 常用命令

```bash
npx pnpm@9 dev          # Turbo：并行 dev（各包自行定义）
npx pnpm@9 senio        # 仅老人端 Expo
npx pnpm@9 family       # 仅子女端 Expo
npx pnpm@9 api          # 仅 API（默认 http://localhost:3001）
npx pnpm@9 build        # 类型检查 / 构建 workspace 包
```

## 下一步（对照 PRD）

1. **Sprint 1**：Supabase 表 + RLS + Realtime，子女端发消息、老人端订阅显示。
2. **Sprint 2**：MiniMax ASR/TTS + LLM 管道接到 `services/api`。
3. **Sprint 3**：LLM 输出 JSON → 客户端执行 `expo-media-library` / `expo-calendar`。

## Git

本地可自由选择是否使用 git；`.gitignore` 已忽略 `node_modules` 等。
