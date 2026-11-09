# dsh-mcp-connectors

DeepSeek Harness (DSH) 的 MCP 连接器中心插件：统一管理 MCP 连接器，并内置微信收发能力。

## 功能

- **连接器面板**：卡片式添加 / 编辑 / 启停 MCP 连接器（streamable-http / stdio / 企业微信）
- **内置预设**：腾讯文档、金山文档（WPS 授权登录）、GitHub（PAT）、微信 (ClawBot)、谷歌浏览器（Chrome DevTools MCP，本机 stdio 运行，无需令牌）
- **微信收发**：基于微信官方 ClawBot 机器人接口，扫码绑定后双向收发消息（文本 / 图片 / 文件）
- **微信自动回复**：守护轮询收消息（无 LLM 开销），新消息自动注入绑定的 DSH 会话，AI 基于该会话上下文回复
- **会话级门控（双层强制）**：restrict 挡工具可见性 + `tools.guard` 在执行层强制校验调用者会话；root 会话与 subagent 均无法绕过（未启用即拒绝，含创建窗口期）
- **stdio 支持**：本地 MCP server 以子进程方式挂载，生命周期自动管理

## 安装

在 DeepSeek Harness 插件管理器中安装：

```
dsh-mcp-connectors
```

依赖：Node.js ≥ 18，微信功能需要最新版微信并开通「微信 ClawBot」插件。

支持的平台：macOS / Linux / Windows（stdio 子进程在 Windows 上经 shell 启动 `npx.cmd`）。

## 使用

- 侧边栏「连接器」面板，顶部两个 Tab：
  - **全部**：所有可用的连接器目录卡片；点击卡片查看说明并创建（填名称、令牌等信息）
  - **已安装**：已创建连接器的管理卡片（编辑 / 启停 / 删除 / 连接状态）
- **自定义连接器**：全部字段放开可编辑；支持直接粘贴 `mcpServers` 格式 JSON 一键填充表单（会自动提取 Bearer token）
- 微信：目录里选「微信 (ClawBot)」→ 扫码绑定 → 选择自动回复会话 → 保存
- 凭据只保存在本机 `~/.dsh/mcp-connectors.json`，不会上传

## 工程结构：连接器注册表（隔离原则）

`client.js` 中的 `CONNECTOR_DEFS` 是唯一需要改动的地方：**每个连接器是一个完全自包含的定义对象**（`id / icon / labelKey / descKey / template / renderAuth()`），框架（Tab 页、卡片、编辑器、保存）只遍历注册表，不认识任何具体连接器。

**新增一个连接器 = 在 `CONNECTOR_DEFS` 里 append 一项**（如需 `descKey` 文案，同步加进 `DICTS.zh/en`）。不需要、也不应该修改任何现有连接器的定义或框架代码——这样一个连接器写坏了也只影响它自己的表单区，旧连接器不受牵连。

`renderAuth(ui)` 接收 `{ h, Field, inputCls, t, api, draft, set, setDraft, initial, onSaved, doSave, busy, setBusy, setAuthMsg }`，返回该连接器特有的表单区（令牌输入、OAuth 按钮、扫码框等）；没有特有字段的（如自定义）设为 `null`。

## 隐私

- 所有令牌 / 凭据 / 会话数据仅存储在用户本机（`~/.dsh/`）
- 微信登录凭证保存在本机 `~/.weixin-mcp/accounts/`
- 本插件不包含任何遥测或数据上传

## License

MIT

## 威胁模型与会话门控边界

会话门控（restrict + tools.guard 双层）只覆盖**工具调用通道**。持有 bash + 网络权限的 AI 理论上可以读 `~/.dsh/mcp-connectors.json` 中的 token 明文并自行直连 MCP 端点绕过门控（实际发生过：AI 通过 mcp-connectors skill 文档获知 token 位置后用 curl 自建 MCP 会话）。

缓解措施：
- skill 文档已加"会话权限红线"并将触发条件收窄为"维护插件本身"，普通数据请求不再加载该文档
- token 文件权限 600
- 彻底阻断需要平台层支持（会话沙箱禁网/禁读 HOME），插件层无法完全防御
