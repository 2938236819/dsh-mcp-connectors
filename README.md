# dsh-mcp-connectors

DeepSeek Harness (DSH) 的 MCP 连接器中心插件：统一管理 MCP 连接器，并内置微信收发能力。

## 功能

- **连接器面板**：卡片式添加 / 编辑 / 启停 MCP 连接器（streamable-http / stdio / 企业微信）
- **内置预设**：腾讯文档、金山文档（WPS 授权登录）、GitHub（PAT）、微信 (ClawBot)
- **微信收发**：基于微信官方 ClawBot 机器人接口，扫码绑定后双向收发消息（文本 / 图片 / 文件）
- **微信自动回复**：守护轮询收消息（无 LLM 开销），新消息自动注入绑定的 DSH 会话，AI 基于该会话上下文回复
- **会话级门控**：每个 DSH 会话可选择启用哪些连接器的工具（以 `mcp__<server>__<tool>` 前缀注入）
- **stdio 支持**：本地 MCP server 以子进程方式挂载，生命周期自动管理

## 安装

在 DeepSeek Harness 插件管理器中安装：

```
dsh-mcp-connectors
```

依赖：Node.js ≥ 18，微信功能需要最新版微信并开通「微信 ClawBot」插件。

支持的平台：macOS / Linux / Windows（stdio 子进程在 Windows 上经 shell 启动 `npx.cmd`）。

## 使用

- 侧边栏「连接器」面板 → 「+ 添加连接器」→ 选择类型
- 微信：选「微信 (ClawBot)」→ 扫码绑定 → 选择自动回复会话 → 保存
- 凭据只保存在本机 `~/.dsh/mcp-connectors.json`，不会上传

## 隐私

- 所有令牌 / 凭据 / 会话数据仅存储在用户本机（`~/.dsh/`）
- 微信登录凭证保存在本机 `~/.weixin-mcp/accounts/`
- 本插件不包含任何遥测或数据上传

## License

MIT
