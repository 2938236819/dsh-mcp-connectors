/**
 * @wfm-cn/dsh-mcp-connectors — MCP 连接器中心（Host 侧）
 *
 * 通道说明：运行期安装的插件拿不到编译期生成的 `remote.*` 命名空间，
 * 因此 Host↔Client 用宿主提供的 HTTP 路由（ctx.webServer.register）：
 *   GET  /mcp-connectors/state
 *   POST /mcp-connectors/save | /remove | /enabled | /session
 *
 * 职责：
 *  1. 连接器清单持久化（~/.dsh/mcp-connectors.json，独立文件）；
 *  2. 为每个启用的连接器动态挂载 @deepseek-ai/dsh-mcp-client（ctx.loader.create）；
 *  3. 每会话工具门控（agent/created + ctx.tools.restrict）。
 */
import { readFileSync, writeFileSync, mkdirSync, appendFileSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';

const DEBUG_LOG = `${homedir()}/.dsh/mcp-connectors-debug.log`;
function dbg(msg, err) {
  try {
    appendFileSync(DEBUG_LOG, `[${new Date().toISOString()}] ${msg}${err ? ` :: ${err?.stack ?? err}` : ''}\n`);
  } catch { /* never break plugin */ }
}

const ROUTE = '/mcp-connectors';
const SERVER_NAME_RE = /^[A-Za-z0-9_-]{1,32}$/;
const MOUNTS_FILE = `${homedir()}/.dsh/.mcp-connectors-mounts.json`;

/** 宿主服务依赖（缺一不可：这些在桌面 profile 中均存在）。 */
export const inject = ['agents', 'sessions', 'webServer', 'tools'];

/** serverName -> { entryId, sig }。持久化到磁盘：config 变更重启插件后仍能增量收敛。 */
function readMounts() {
  // 工具注册是本插件进程内的 effect：重启后 disposers 已失效，
  // 因此每次启动一律从空表开始重新注册；文件仅作观测记录。
  return new Map();
}
function writeMounts(map) {
  try {
    writeFileSync(MOUNTS_FILE, JSON.stringify(Object.fromEntries(map), null, 0));
  } catch {
    /* 挂载登记失败不影响主流程 */
  }
}

function sanitizeConnector(input) {
  if (!input || typeof input !== 'object') throw new Error('connector 必须是对象');
  const serverName = String(input.serverName ?? '').trim();
  if (!SERVER_NAME_RE.test(serverName)) {
    throw new Error('标识只能包含字母、数字、下划线、连字符，长度 1-32');
  }
  const transport = input.transport === 'wecom' ? 'wecom'
    : input.transport === 'stdio' ? 'stdio' : 'streamable-http';
  const c = {
    id: String(input.id ?? '').trim() || `c_${serverName}_${Date.now().toString(36)}`,
    serverName,
    title: String(input.title ?? '').trim() || serverName,
    transport,
    enabled: input.enabled !== false,
    note: String(input.note ?? ''),
  };
  if (transport === 'wecom') {
    // 企业微信官方 API：CorpID + 应用 Secret，access_token 由插件自动续期
    const corpid = String(input.corpid ?? '').trim();
    const secret = String(input.secret ?? '').trim();
    if (!corpid) throw new Error('企业微信连接器必须填写 CorpID');
    if (!secret) throw new Error('企业微信连接器必须填写应用的 Secret');
    c.corpid = corpid;
    // '●' 是界面打码值（未修改），由 /save 的保留逻辑回填真实凭据
    if (secret !== '●') c.secret = secret;
    const agentid = parseInt(String(input.agentid ?? ''), 10);
    if (Number.isInteger(agentid) && agentid > 0) c.agentid = agentid;
    return c;
  }
  if (transport === 'stdio') {
    if (!input.command || !String(input.command).trim()) throw new Error('stdio 连接器必须填写 command');
    c.command = String(input.command).trim();
    c.args = Array.isArray(input.args) ? input.args.map(String) : [];
    c.env = input.env && typeof input.env === 'object' ? StringMap(input.env) : {};
    // 微信连接器：自动回复注入的目标会话
    const targetSession = String(input.targetSession ?? '').trim();
    if (targetSession) c.targetSession = targetSession;
  } else {
    if (!input.url || !/^https?:\/\//i.test(String(input.url))) throw new Error('URL 必须以 http(s):// 开头');
    c.url = String(input.url).trim();
    let token = String(input.token ?? '').trim();
    // 用户可能把整条"安装指令"粘进来（链接 + 说明文字 + TENCENT_DOCS_TOKEN="xxx"）。
    // 依次尝试：环境变量赋值式 → token= 参数式 → 最长的纯 token 形态连续串。
    if (token && /[\s。;；]/.test(token)) {
      token =
        /(?:TENCENT_DOCS_TOKEN|TOKEN|ACCESS_TOKEN)\s*[=:]\s*"?([A-Za-z0-9_\-.]{8,})"?/.exec(token)?.[1]
        ?? /(?:\?|&|\b)token=([A-Za-z0-9_\-.]{8,})/.exec(token)?.[1]
        ?? (token.match(/[A-Za-z0-9_\-]{20,}/) ?? [''])[0]
        ?? '';
    }
    token = token.replace(/["'”“]/g, '').trim();
    if (token && token !== '●') c.token = token;
    const headers = input.headers && typeof input.headers === 'object' ? StringMap(input.headers) : {};
    if (Object.keys(headers).length) c.headers = headers;
  }
  return c;
}

function StringMap(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[String(k)] = String(v);
  return out;
}

/** 影响挂载的字段指纹（标题/备注/启停不触发重挂）。 */
function signature(c) {
  return JSON.stringify({
    serverName: c.serverName,
    transport: c.transport,
    corpid: c.corpid,
    secret: c.secret,
    url: c.url,
    token: c.token,
    headers: c.headers,
    command: c.command,
    args: c.args,
    env: c.env,
  });
}

function enabledServersOf(config, sessionId) {
  const all = (config?.connectors ?? []).filter((c) => c.enabled !== false).map((c) => c.serverName);
  const chosen = config?.sessions?.[sessionId];
  // fail-closed：未记录的会话默认不启用任何连接器，必须在该会话中显式勾选
  if (!chosen) return new Set();
  return new Set(all.filter((s) => chosen.includes(s)));
}

async function readJsonBody(req, limit = 1_000_000) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > limit) throw new Error('payload-too-large');
    chunks.push(chunk);
  }
  if (total === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

export async function apply(ctx, config = {}) {
  // 在插件激活上下文中预先捕获服务引用：异步回调（轮询循环等）里
  // 直接访问 ctx.agents/ctx.sessions 会因上下文失活而报错
  const AGENTS = ctx.agents;
  const SESSIONS = ctx.sessions;
  const log = (...a) => ctx.logger?.info?.('[mcp-connectors]', ...a);
  const warn = (...a) => ctx.logger?.warn?.('[mcp-connectors]', ...a);
  const MOUNTED = readMounts();
  const AUTH_PENDING = new Map(); // serverName -> { status, loginUrl?, error? }
  const WX_AUTH = new Map();      // serverName -> { status, image?, accountFile?, error? }
  const WX_AUTH_STOP = new Map(); // serverName -> { cancelled } 停止标记
  dbg(`apply: mounted=${[...MOUNTED.keys()].join(',') || '(none)'}, connectors=${(config?.connectors ?? STATE?.connectors ?? []).length}`);

  /* ---------------- 持久化（独立 JSON 文件，绝不碰 profile 的 cordis.patch.yml） ---------------- */

  const STATE_FILE = `${homedir()}/.dsh/mcp-connectors.json`;
  const readState = () => {
    try {
      const raw = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
      return {
        connectors: Array.isArray(raw?.connectors) ? raw.connectors : [],
        sessions: raw?.sessions && typeof raw.sessions === 'object' ? raw.sessions : {},
      };
    } catch {
      return { connectors: [], sessions: {} };
    }
  };

  let STATE = readState();

  const persist = async () => {
    writeFileSync(STATE_FILE, JSON.stringify(STATE, null, 2));
  };

  const currentConfig = () => STATE;

  /* ---------------- MCP 挂载：自管会话 + defineTool 桥接 ---------------- */

  let DEFINE_TOOL = null;
  async function ensureDefineTool() {
    if (DEFINE_TOOL !== null) return DEFINE_TOOL;
    const candidates = [];
    if (process.resourcesPath) {
      candidates.push(`${process.resourcesPath}/app.asar/dsh/node_modules/@deepseek-ai/dsh-tools/lib/index.js`);
    }
    candidates.push('/Applications/DeepSeek Harness.app/Contents/Resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-tools/lib/index.js');
    for (const p of candidates) {
      try {
        const mod = await import(pathToFileURL(p).href);
        if (typeof mod.defineTool === 'function') {
          DEFINE_TOOL = mod.defineTool;
          return DEFINE_TOOL;
        }
      } catch { /* try next */ }
    }
    DEFINE_TOOL = false;
    return DEFINE_TOOL;
  }

  /** 每个已挂载服务器的活会话：{ id, headers }；404/过期时自动重新 initialize 一次。 */
  const HTTP_SESSIONS = new Map(); // serverName -> { id }

  function sessionHeaders(c) {
    return {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...(c.token ? { authorization: `Bearer ${c.token}` } : {}),
      ...(c.headers ?? {}),
    };
  }

  /** stdio 型 MCP：子进程 + stdin/stdout 行分隔 JSON-RPC。serverName -> client */
  const STDIO_CLIENTS = new Map();

  function stdioClient(c) {
    let cl = STDIO_CLIENTS.get(c.serverName);
    if (cl) return cl;
    // Windows 上 npx/pnpm 等命令是 .cmd shim，必须经 shell 才能启动；
    // macOS/Linux 不加 shell，避免参数被 shell 二次解析
    const isWin = process.platform === 'win32';
    let command = c.command;
    if (isWin) {
      const s = String(command).trim();
      if (/^(npx|npm|pnpm|yarn|bunx?|uvx?|python3?|node)$/i.test(s)) command = `${s}.cmd`;
      else if (/[\\/ ]/.test(s) && !/\.(cmd|exe|bat|ps1)$/i.test(s)) command = s; // 完整路径交给 shell 解析
    }
    const child = spawn(command, c.args ?? [], {
      env: { ...process.env, ...(c.env ?? {}) },
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: isWin,
      windowsHide: true,
    });
    child.on('exit', () => STDIO_CLIENTS.delete(c.serverName));
    const pending = new Map();
    let buf = '';
    let nextId = 1;
    child.stdout.on('data', (d) => {
      buf += d.toString();
      let idx;
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line) continue;
        let msg;
        try { msg = JSON.parse(line); } catch { continue; }
        if (msg?.id !== undefined && pending.has(msg.id)) {
          pending.get(msg.id)(msg);
          pending.delete(msg.id);
        }
      }
    });
    child.stderr.on('data', () => { /* 服务端日志，丢弃 */ });
    const call = (method, params, timeoutMs = 60000) => new Promise((resolve, reject) => {
      if (child.exitCode !== null) { reject(new Error(`MCP 子进程已退出（code ${child.exitCode}）`)); return; }
      const id = nextId++;
      const payload = { jsonrpc: '2.0', id, method, ...(params !== undefined ? { params } : {}) };
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`MCP stdio 请求超时：${method}`)); }, timeoutMs);
      pending.set(id, (msg) => { clearTimeout(timer); resolve(msg); });
      try { child.stdin.write(JSON.stringify(payload) + '\n'); }
      catch (e) { clearTimeout(timer); pending.delete(id); reject(e); }
    });
    cl = {
      call,
      dispose: () => { try { child.kill(); } catch { /* ignore */ } STDIO_CLIENTS.delete(c.serverName); },
      child,
    };
    STDIO_CLIENTS.set(c.serverName, cl);
    return cl;
  }

  async function stdioInit(c) {
    const cl = stdioClient(c);
    const init = await cl.call('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'mcp-connectors', version: '0.1.0' },
    });
    if (init.error) throw new Error(`stdio initialize 失败：${init.error.message ?? 'unknown'}`);
    cl.call('notifications/initialized').catch(() => {});
    return init.result;
  }

  async function mcpRpc(c, payload, { fresh = false } = {}) {
    // stdio 连接器走子进程通道
    if (c.transport === 'stdio') {
      return stdioClient(c).call(payload.method, payload.params);
    }
    const sid = fresh ? undefined : HTTP_SESSIONS.get(c.serverName)?.id;
    const res = await fetch(c.url, {
      method: 'POST',
      headers: sid ? { ...sessionHeaders(c), 'mcp-session-id': sid } : sessionHeaders(c),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const err = new Error(`MCP ${res.status}: ${text.slice(0, 300)}`);
      err.status = res.status;
      throw err;
    }
    const newSid = res.headers?.get?.('mcp-session-id');
    if (newSid) {
      const rec = HTTP_SESSIONS.get(c.serverName) ?? {};
      rec.id = newSid;
      HTTP_SESSIONS.set(c.serverName, rec);
    }
    const raw = await res.text();
    const dataLine = raw.split('\n').find((l) => l.startsWith('data:'));
    return JSON.parse((dataLine ? dataLine.slice(5) : raw).trim());
  }

  async function ensureSession(c) {
    const init = await mcpRpc(c, {
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'mcp-connectors', version: '0.1.0' },
      },
    }, { fresh: true });
    if (init.error) throw new Error(`initialize 失败：${init.error.message ?? 'unknown'}`);
    await mcpRpc(c, { jsonrpc: '2.0', method: 'notifications/initialized' }).catch(() => {});
    return init.result;
  }

  /** JSON Schema（MCP inputSchema）→ schemastery 风格字段映射（defineTool 的 parameters）。
   *  同时返回原始类型表，供 execute 把模型误传的 JSON 字符串还原成对象/数组。 */
  function convertParams(schema) {
    const out = {};
    const types = {};
    const props = schema?.properties ?? {};
    const required = new Set(schema?.required ?? []);
    for (const [key, def] of Object.entries(props)) {
      const field = { description: def.description ?? undefined };
      if (Array.isArray(def.enum) && def.enum.length) field.enum = def.enum;
      switch (def.type) {
        case 'string': field.type = 'string'; break;
        case 'number': field.type = 'number'; break;
        case 'integer': field.type = 'integer'; break;
        case 'boolean': field.type = 'boolean'; break;
        case 'array':
          // 纯 array 声明；元素结构交给 execute 做字符串回退解析
          field.type = 'array';
          break;
        case 'object':
          field.type = 'object';
          field.additionalProperties = true;
          break;
        default:
          // 无类型或复合类型（oneOf/anyOf 等）：按字符串接收
          field.type = 'string';
          if (!field.description) field.description = 'JSON value';
      }
      if (required.has(key)) field.required = true;
      out[key] = field;
      types[key] = def.type ?? 'string';
    }
    return { fields: out, types };
  }

  function publicToolName(serverName, rawName) {
    const clean = String(rawName).replace(/[^A-Za-z0-9_-]/g, '_');
    if (clean === rawName) return `mcp__${serverName}__${rawName}`;
    // 有损归一化时追加短哈希避免碰撞（与 dsh-mcp-client 思路一致）
    let hash = 0;
    for (const ch of rawName) hash = ((hash * 31) + ch.charCodeAt(0)) >>> 0;
    return `mcp__${serverName}__${clean}_${hash.toString(16).slice(0, 8)}`;
  }

  async function registerServerTools(ctx, c, defineTool) {
    await ensureSession(c);
    const list = await mcpRpc(c, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    const tools = list?.result?.tools ?? [];
    const disposers = [];
    const registeredNames = []; // 只记录实际注册成功的名字：deny 名单必须与全局注册表严格一致
    for (const t of tools.slice(0, 300)) {
      if (!t?.name) continue;
      const name = publicToolName(c.serverName, t.name);
      const { fields, types } = convertParams(t.inputSchema);
      try {
        const dispose = ctx.tools.register(defineTool({
          name,
          description: `[${c.serverName}] ${t.description ?? t.name}`,
          parameters: fields,
          output: {
            schema: { type: 'json' },
            // render 的返回值会直接成为 result.content（必须是 block 数组）
            render: (_args, value) => {
              if (Array.isArray(value?.content)) return value.content;
              if (typeof value === 'string') return [{ type: 'text', text: value }];
              return [{ type: 'text', text: JSON.stringify(value ?? null) }];
            },
          },
          timeoutMs: 60000,
          async execute(args, exec) {
            // 模型可能把 object/array 参数传成 JSON 字符串：按原始类型表还原
            const norm = { ...(args ?? {}) };
            for (const [k, v] of Object.entries(norm)) {
              if (typeof v === 'string' && (types[k] === 'object' || types[k] === 'array')) {
                try { norm[k] = JSON.parse(v); } catch { /* 保持原样，由远端校验报错 */ }
              }
            }
            const call = async () => mcpRpc(c, {
              jsonrpc: '2.0', id: Date.now() % 1e9, method: 'tools/call',
              params: { name: t.name, arguments: norm },
            }, exec?.signal ? {} : {});
            let result;
            try {
              result = await call();
            } catch (e) {
              // 会话可能过期：重建一次再试
              await ensureSession(c);
              result = await call();
            }
            if (result?.error) throw new Error(result.error.message ?? 'MCP call failed');
            const rc = result?.result;
            if (rc?.isError) {
              const first = (rc.content ?? []).find((b) => b?.type === 'text');
              throw new Error(first?.text ?? 'tool reported error');
            }
            const blocks = (rc?.content ?? [])
              .filter((b) => b?.type === 'text' && b.text)
              .map((b) => ({ type: 'text', text: b.text }));
            if (blocks.length === 0 && rc != null) {
              blocks.push({ type: 'text', text: JSON.stringify(rc) });
            }
            return { content: blocks };
          },
        }));
        disposers.push(dispose);
        registeredNames.push(t.name); // 原始名；消费方（deny 名单）会用 publicToolName 再转换
      } catch (e) {
        dbg(`register tool FAILED ${name}`, e);
        warn(`注册工具 ${name} 失败：`, e?.message ?? e);
      }
    }
    return { count: disposers.length, disposers, toolNames: registeredNames };
  }

  /* ---------------- 企业微信（官方 API）：token 自动续期 + 内置工具 ---------------- */

  const WECOM_TOKENS = new Map(); // serverName -> { token, expiresAt }

  async function wecomToken(c) {
    const rec = WECOM_TOKENS.get(c.serverName);
    if (rec && Date.now() < rec.expiresAt - 120000) return rec.token;
    const res = await fetch(
      `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${encodeURIComponent(c.corpid)}&corpsecret=${encodeURIComponent(c.secret)}`,
      { signal: AbortSignal.timeout(15000) },
    );
    const j = await res.json().catch(() => null);
    if (!j || j.errcode !== 0 || !j.access_token) {
      throw new Error(`获取 access_token 失败：${j?.errmsg ?? 'HTTP ' + res.status}（errcode ${j?.errcode ?? '?'}）`);
    }
    WECOM_TOKENS.set(c.serverName, { token: j.access_token, expiresAt: Date.now() + (j.expires_in ?? 7200) * 1000 });
    return j.access_token;
  }

  async function wecomApi(c, path, payload) {
    const token = await wecomToken(c);
    const res = await fetch(`https://qyapi.weixin.qq.com${path}${path.includes('?') ? '&' : '?'}access_token=${token}`, {
      method: payload === undefined ? 'GET' : 'POST',
      headers: payload === undefined ? undefined : { 'content-type': 'application/json' },
      body: payload === undefined ? undefined : JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    });
    const j = await res.json().catch(() => null);
    if (!j) throw new Error(`企业微信响应异常（HTTP ${res.status}）`);
    // 42001/40014 = token 过期：强制刷新重试一次
    if ((j.errcode === 42001 || j.errcode === 40014)) {
      WECOM_TOKENS.delete(c.serverName);
      const t2 = await wecomToken(c);
      const res2 = await fetch(`https://qyapi.weixin.qq.com${path}${path.includes('?') ? '&' : '?'}access_token=${t2}`, {
        method: payload === undefined ? 'GET' : 'POST',
        headers: payload === undefined ? undefined : { 'content-type': 'application/json' },
        body: payload === undefined ? undefined : JSON.stringify(payload),
        signal: AbortSignal.timeout(20000),
      });
      return res2.json().catch(() => null);
    }
    return j;
  }

  function registerWecomTools(ctx, c, defineTool) {
    const disposers = [];
    const base = { title: c.title || c.serverName };
    const mk = (def) => {
      const d = ctx.tools.register(defineTool(def));
      disposers.push(d);
    };
    mk({
      name: `wecom__${c.serverName}__send_text`,
      description: `[企业微信] 给指定成员（或应用群聊）发送文本消息。参数二选一：to_user 为成员账号（多个用 | 分隔），chatid 为应用群聊 id。`,
      parameters: {
        to_user: { type: 'string', description: '成员 userid，多个用 | 分隔；与 chatid 二选一' },
        chatid: { type: 'string', description: '应用群聊 id；与 to_user 二选一' },
        content: { type: 'string', required: true, description: '要发送的文本内容' },
      },
      output: { schema: { type: 'json' }, render: (_a, v) => [{ type: 'text', text: typeof v === 'string' ? v : JSON.stringify(v) }] },
      async execute(args) {
        const content = String(args?.content ?? '');
        if (!content) throw new Error('content 不能为空');
        if (args?.chatid) {
          const j = await wecomApi(c, '/cgi-bin/appchat/send', { chatid: args.chatid, msgtype: 'text', text: { content } });
          if (j.errcode !== 0) throw new Error(`发送失败：${j.errmsg}（${j.errcode}）`);
          return '已发送到群聊 ' + args.chatid;
        }
        if (!args?.to_user) throw new Error('to_user 与 chatid 必须提供一个');
        const j = await wecomApi(c, '/cgi-bin/message/send', {
          touser: args.to_user, msgtype: 'text', agentid: c.agentid ?? 1000002, text: { content },
        });
        if (j.errcode !== 0) throw new Error(`发送失败：${j.errmsg}（${j.errcode}）`);
        return '已发送给 ' + args.to_user;
      },
    });
    mk({
      name: `wecom__${c.serverName}__list_departments`,
      description: `[企业微信] 列出企业的部门树。`,
      parameters: {},
      output: { schema: { type: 'json' }, render: (_a, v) => [{ type: 'text', text: typeof v === 'string' ? v : JSON.stringify(v) }] },
      async execute() {
        const j = await wecomApi(c, '/cgi-bin/department/list', undefined);
        if (j.errcode !== 0) throw new Error(`查询失败：${j.errmsg}（${j.errcode}）`);
        return (j.department ?? []).map((d) => `${d.id}: ${d.name}`).join('\n') || '（无部门）';
      },
    });
    mk({
      name: `wecom__${c.serverName}__list_users`,
      description: `[企业微信] 列出某部门下的成员（含子部门）。`,
      parameters: {
        department_id: { type: 'integer', required: true, description: '部门 id（可用 list_departments 查询）' },
      },
      output: { schema: { type: 'json' }, render: (_a, v) => [{ type: 'text', text: typeof v === 'string' ? v : JSON.stringify(v) }] },
      async execute(args) {
        const dep = parseInt(String(args?.department_id ?? '1'), 10);
        const j = await wecomApi(c, `/cgi-bin/user/simplelist?department_id=${dep}&fetch_child=1`, undefined);
        if (j.errcode !== 0) throw new Error(`查询失败：${j.errmsg}（${j.errcode}）`);
        return (j.userlist ?? []).map((u) => `${u.userid}: ${u.name}`).join('\n') || '（该部门无成员）';
      },
    });
    return { count: disposers.length, disposers, toolNames: disposers.map((_, i) => ['send_text', 'list_departments', 'list_users'][i] ?? '') };
  }

  const unmount = async (serverName, why) => {
    stopWeixinPoller(serverName);
    const rec = MOUNTED.get(serverName);
    if (!rec) return;
    for (const d of rec.disposers ?? []) {
      try { await d(); } catch { /* ignore */ }
    }
    STDIO_CLIENTS.get(serverName)?.dispose();
    HTTP_SESSIONS.delete(serverName);
    MOUNTED.delete(serverName);
    writeMounts(MOUNTED);
    log(`已卸载 ${serverName}（${rec.toolCount ?? '?'} 个工具）${why ? `：${why}` : ''}`);
  };

  /* ---------------- 微信自动回复：守护轮询 + 会话注入 ---------------- */

  const WX_POLLERS = new Map();   // serverName -> { stop }
  const WX_SEEN = new Map();      // serverName -> Set<message_id>

  /** 把一条用户消息注入目标会话（等价 schedule 的投递方式：followup + flush）。 */
  async function injectPrompt(sessionId, text, sourceKind) {
    const agent = AGENTS?.get?.(sessionId);
    if (!agent) throw new Error(`目标会话不存在或未加载：${sessionId}`);
    const message = {
      id: randomUUID(),
      role: 'user',
      content: [{ type: 'text', text }],
      source: { kind: sourceKind },
    };
    agent.followup?.(message) ?? agent.inject?.(message);
    if (SESSIONS?.flush) await SESSIONS.flush(agent.session);
  }

  function startWeixinPoller(c) {
    if (WX_POLLERS.has(c.serverName)) return;
    const seen = WX_SEEN.get(c.serverName) ?? new Set();
    WX_SEEN.set(c.serverName, seen);
    const stop = { cancelled: false };
    WX_POLLERS.set(c.serverName, stop);
    log(`微信守护轮询已启动：${c.serverName}`);
    (async () => {
      while (!stop.cancelled) {
        await new Promise((r) => setTimeout(r, 5000));
        try {
          const cl = STDIO_CLIENTS.get(c.serverName);
          if (!cl || cl.child.exitCode !== null) continue;
          const sessionId = currentConfig().connectors.find((x) => x.serverName === c.serverName)?.targetSession;
          if (!sessionId) continue;
          const resp = await cl.call('tools/call', { name: 'weixin_poll', arguments: {} }, 30000);
          const rc = resp?.result;
          if (resp?.error || rc?.isError) continue;
          const first = (rc?.content ?? []).find((b) => b?.type === 'text');
          if (!first?.text) continue;
          let data;
          try { data = JSON.parse(first.text); } catch { continue; }
          for (const msg of data?.msgs ?? []) {
            if (seen.has(msg.message_id)) continue;
            seen.add(msg.message_id);
            const sender = msg.from_user_id ?? '';
            const token = msg.context_token ?? '';
            const items = msg.item_list ?? [];
            const textPart = items.map((it) => it?.text_item?.text ?? '').filter(Boolean).join('\n');
            const prompt = [
              '[微信消息] ClawBot 收到新微信消息，请直接处理并回复：',
              `调用工具 mcp__weixin-mcp__weixin_send，参数 to="${sender}"${token ? `，context_token="${token}"` : ''}，text=你的回复内容。`,
              `发送者：${sender}`,
              `消息内容：${textPart || '(非文本消息)'}`,
            ].join('\n');
            try {
              await injectPrompt(sessionId, prompt, 'weixin');
              log(`微信消息已注入会话 ${sessionId}（from ${sender}）`);
            } catch (e) {
              dbg(`微信消息注入失败 ${sessionId}`, e);
            }
          }
        } catch { /* 轮询瞬时失败，下轮重试 */ }
      }
    })();
  }

  function stopWeixinPoller(serverName) {
    const stop = WX_POLLERS.get(serverName);
    if (stop) { stop.cancelled = true; WX_POLLERS.delete(serverName); log(`微信守护轮询已停止：${serverName}`); }
  }

  const mount = async (c) => {
    dbg(`mount: start ${c.serverName} (${c.transport})`);
    if (c.transport === 'wecom') {
      const defineTool2 = await ensureDefineTool();
      if (!defineTool2) {
        warn('无法加载宿主 dsh-tools（defineTool），跳过企业微信挂载');
        return;
      }
      const reg = registerWecomTools(ctx, c, defineTool2);
      MOUNTED.set(c.serverName, { disposers: reg.disposers, sig: signature(c), toolCount: reg.count, tools: reg.toolNames });
      writeMounts(MOUNTED);
      log(`已挂载企业微信 ${c.serverName}：${reg.count} 个工具`);
      return;
    }
    if (c.transport === 'stdio') {
      const defineTool = await ensureDefineTool();
      dbg(`mount: defineTool loaded=${defineTool ? 'yes' : 'NO'}`);
      if (!defineTool) {
        warn('无法加载宿主 dsh-tools（defineTool），跳过挂载');
        return;
      }
      try {
        await stdioInit(c);
        const { count, disposers, toolNames } = await registerServerTools(ctx, c, defineTool);
        dbg(`mount: registered ${count}/${toolNames.length} tools for ${c.serverName}`);
        MOUNTED.set(c.serverName, { disposers, sig: signature(c), toolCount: count, tools: toolNames });
        writeMounts(MOUNTED);
        log(`已挂载 stdio ${c.serverName}：${count} 个工具`);
        if (count > 0) startWeixinPoller(c);
      } catch (e) {
        dbg(`mount: FAILED ${c.serverName}`, e);
        STDIO_CLIENTS.get(c.serverName)?.dispose();
        warn(`挂载 ${c.serverName} 失败：`, e?.message ?? e);
      }
      return;
    }
    if (c.transport !== 'streamable-http') {
      warn(`连接器 ${c.serverName} transport=${c.transport}，不支持，跳过`);
      return;
    }
    const defineTool = await ensureDefineTool();
    dbg(`mount: defineTool loaded=${defineTool ? 'yes' : 'NO'}`);
    if (!defineTool) {
      warn('无法加载宿主 dsh-tools（defineTool），跳过挂载');
      return;
    }
    try {
      const { count, disposers, toolNames } = await registerServerTools(ctx, c, defineTool);
    dbg(`mount: registered ${count}/${toolNames.length} tools for ${c.serverName}`);
      MOUNTED.set(c.serverName, { disposers, sig: signature(c), toolCount: count, tools: toolNames });
      writeMounts(MOUNTED);
      log(`已挂载 ${c.serverName}：${count} 个工具`);
    } catch (e) {
      dbg(`mount: FAILED ${c.serverName}`, e);
      warn(`挂载 ${c.serverName} 失败：`, e?.message ?? e);
    }
  };

  const syncMounts = async () => {
    const cfg = currentConfig();
    dbg(`syncMounts: want=${cfg.connectors.filter(c => c.enabled !== false).map(c => c.serverName).join(',') || '(none)'}`);
    const want = new Map(
      cfg.connectors.filter((c) => c.enabled !== false).map((c) => [c.serverName, c]),
    );
    for (const [sn, rec] of [...MOUNTED]) {
      const w = want.get(sn);
      if (!w || signature(w) !== rec.sig) await unmount(sn, w ? '配置已变更' : '已移除或停用');
    }
    for (const [sn, w] of want) {
      if (!MOUNTED.has(sn)) await mount(w);
    }
    // 工具集变化后重新计算各会话的门控（deny 依赖已注册的工具名）
    reapplyGates();
  };

  /* ---------------- 每会话工具门控 ---------------- */

  const RESTRICTORS = new Map(); // agentId -> disposer
  const GATE_PENDING = new Set(); // 因工具尚未注册而待重试的 agentId
  const LAST_DENY = new Map(); // agentId -> deny 签名（幂等：状态未变则不重建 restrictor）

  /** 当前已挂载连接器的公开工具名（含 mcp__server__ 前缀）。 */
  function mountedToolNamesByServer() {
    const out = new Map(); // serverName -> string[]
    for (const [serverName, rec] of MOUNTED) {
      const names = (rec.tools ?? []).map((raw) => publicToolName(serverName, raw));
      if (names.length) out.set(serverName, names);
    }
    return out;
  }

  /** 对单个 agent 应用会话级门控：禁用连接器的工具全部 deny。 */
  const applyGate = (agent) => {
    const agentCtx = agent?.ctx;
    if (!agentCtx?.tools?.restrict) {
      // agent 刚创建时 ctx 可能尚未注入 tools 服务：记入 pending，等周期重试
      if (agent?.id) GATE_PENDING.add(agent.id);
      dbg(`gate: agent ${agent?.id} not ready (no tools.restrict), pending`);
      return;
    }
    const sessionId = String(agent.session?.id ?? agent.id ?? '');
    const allowed = enabledServersOf(currentConfig(), sessionId);
    const byServer = mountedToolNamesByServer();
    // 还没挂载完（工具尚未注册）时调用 restrict 会因 unknown name 抛错：留到挂载后再试
    const deny = [];
    for (const [serverName, names] of byServer) {
      if (!allowed.has(serverName)) deny.push(...names);
    }
    // 幂等：期望状态与当前一致则不动
    const denySig = deny.join(',');
    if (RESTRICTORS.has(agent.id) && LAST_DENY.get(agent.id) === denySig) {
      GATE_PENDING.delete(agent.id);
      return;
    }
    dbg(`gate: session=${sessionId} allowed=[${[...allowed]}] deny=${deny.length} tools`);
    try { RESTRICTORS.get(agent.id)?.(); } catch { /* ignore */ }
    RESTRICTORS.delete(agent.id);
    LAST_DENY.delete(agent.id);
    if (deny.length === 0) { GATE_PENDING.delete(agent.id); return; }
    try {
      const dispose = agentCtx.tools.restrict({ deny });
      RESTRICTORS.set(agent.id, dispose);
      LAST_DENY.set(agent.id, denySig);
      GATE_PENDING.delete(agent.id);
    } catch (e) {
      // 工具名尚未生效（挂载中）：记下，稍后重试
      if (/unknown global tool/i.test(String(e?.message ?? ''))) {
        GATE_PENDING.add(agent.id);
        dbg(`gate: pending session=${sessionId} err=${String(e?.message ?? '').slice(0, 200)}`);
      } else {
        warn(`会话 ${sessionId} 工具门控失败：`, e?.message ?? e);
      }
    }
  };

  /** 挂载/卸载后重新应用所有 agent 的门控（门控依赖已注册的工具名）。 */
  const reapplyGates = () => {
    for (const agent of AGENTS?.list?.() ?? []) applyGate(agent);
  };

  /* ---------------- HTTP 路由 ---------------- */

  const state = () => {
    const cfg = currentConfig();
    return {
      connectors: cfg.connectors.map((c) => ({
        ...c,
        token: c.token ? '●' : '',
        secret: c.secret ? '●' : '',
      })),
      sessions: cfg.sessions ?? {},
      mounted: [...MOUNTED.keys()],
      toolCounts: Object.fromEntries([...MOUNTED.entries()].map(([k, v]) => [k, v.toolCount ?? 0])),
    };
  };

  const handlers = {
    'GET /state': async () => ({ ok: true, value: state() }),

    'GET /sessions': async () => {
      // 活跃 agent（运行中/已加载的会话）
      const live = (ctx.agents?.list?.() ?? []).map((a) => ({
        id: a?.session?.id ?? a?.id ?? '',
        title: a?.session?.title ?? a?.title ?? '',
        cwd: a?.session?.cwd ?? '',
        live: true,
        status: a?.status ?? '',
      })).filter((x) => x.id);
      const liveIds = new Set(live.map((x) => x.id));

      // 历史会话（标题/工作区/时间来自每会话的投影缓存文件）
      const history = [];
      try {
        const dir = `${homedir()}/.dsh/storages/session_projcache/sessions`;
        for (const file of readdirSync(dir)) {
          if (!file.endsWith('.json')) continue;
          try {
            const rec = JSON.parse(readFileSync(`${dir}/${file}`, 'utf-8'))?.record;
            if (!rec) continue;
            const rows = rec?.rows ?? {};
            let updatedSeq = 0;
            for (const row of Object.values(rows)) if (Number(row?.seq) > updatedSeq) updatedSeq = Number(row?.seq);
            const id = rec?.identity?.sessionId ?? file.replace('.json', '');
            if (!id) continue;
            history.push({
              id,
              title: rows?.title?.val ?? '',
              cwd: rec?.identity?.cwd ?? '',
              createdAt: rec?.identity?.createdAt ?? 0,
              updatedSeq,
              live: liveIds.has(id),
            });
          } catch { /* 单文件损坏跳过 */ }
        }
      } catch { /* 投影缓存不可用时只返回活跃会话 */ }
      history.sort((a, b) => b.updatedSeq - a.updatedSeq || b.createdAt - a.createdAt);
      // 合并：活跃会话保留 live 标记，但标题/工作区优先用历史缓存里的完整数据
      const byId = new Map(history.map((s) => [s.id, s]));
      const merged = live.map((s) => ({ ...byId.get(s.id), ...s, title: s.title || byId.get(s.id)?.title || '', cwd: s.cwd || byId.get(s.id)?.cwd || '' }));
      for (const s of history) if (!liveIds.has(s.id)) merged.push(s);
      return { ok: true, value: merged };
    },


    'POST /save': async (body) => {
      const c = sanitizeConnector(body?.connector);
      const cfg = currentConfig();
      const idx = cfg.connectors.findIndex((x) => x.id === c.id || x.serverName === c.serverName);
      // token/secret 留空（编辑其他字段）时沿用已存储的凭据，绝不因顺手改动而丢失
      if (!c.token && idx >= 0 && cfg.connectors[idx].token) {
        c.token = cfg.connectors[idx].token;
      }
      if (c.transport === 'wecom' && !c.secret && idx >= 0 && cfg.connectors[idx].secret) {
        c.secret = cfg.connectors[idx].secret;
      }
      const next = idx >= 0
        ? cfg.connectors.map((x, i) => (i === idx ? c : x))
        : [...cfg.connectors, c];
      STATE = { ...cfg, connectors: next };
      await persist();
      await syncMounts();
      return { ok: true, value: { id: c.id } };
    },

    'POST /remove': async (body) => {
      const id = String(body?.id ?? '');
      const cfg = currentConfig();
      const target = cfg.connectors.find((x) => x.id === id);
      if (!target) return { ok: false, error: { message: `找不到连接器 ${id}` } };
      const next = cfg.connectors.filter((x) => x.id !== id);
      STATE = { ...cfg, connectors: next };
      await unmount(target.serverName, '已删除');
      await persist();
      return { ok: true, value: { removed: id } };
    },

    'POST /enabled': async (body) => {
      const id = String(body?.id ?? '');
      const on = body?.enabled === true;
      const cfg = currentConfig();
      if (!cfg.connectors.some((x) => x.id === id)) {
        return { ok: false, error: { message: `找不到连接器 ${id}` } };
      }
      const next = cfg.connectors.map((x) => (x.id === id ? { ...x, enabled: on } : x));
      STATE = { ...cfg, connectors: next };
      await persist();
      await syncMounts();
      return { ok: true, value: { id, enabled: on } };
    },

    'POST /session': async (body) => {
      const sessionId = String(body?.sessionId ?? '');
      if (!sessionId) return { ok: false, error: { message: '缺少 sessionId' } };
      const list = Array.isArray(body?.enabled)
        ? body.enabled.filter((s) => typeof s === 'string' && SERVER_NAME_RE.test(s))
        : [];
      const cfg = currentConfig();
      const sessions = { ...(cfg.sessions ?? {}) };
      // 直接保存勾选列表：全选=完整数组，全部取消=空数组。未记录会话默认全关（fail-closed）
      sessions[sessionId] = list;
      STATE = { ...cfg, sessions };
      await persist();
      for (const agent of ctx.agents?.list?.() ?? []) applyGate(agent);
      return { ok: true, value: { sessionId, enabled: list } };
    },

    /** WPS 授权登录：生成一次性授权码 + 登录链接，后台轮询换取 token 并自动写入连接器。 */
    'POST /auth/start': async (body) => {
      const serverName = String(body?.serverName ?? '');
      const cfg = currentConfig();
      const c = cfg.connectors.find((x) => x.serverName === serverName);
      if (!c) return { ok: false, error: { message: `找不到连接器 ${serverName}` } };
      const code = randomUUID();
      const loginUrl =
        'https://account.wps.cn/login?cb=' +
        encodeURIComponent(`https://api.wps.cn/office/v5/ai/skill_hub/users/callback?code=${code}`);
      AUTH_PENDING.set(serverName, { status: 'waiting' });
      // 后台轮询（最长 5 分钟），成功即写回该连接器并重挂
      (async () => {
        for (let i = 0; i < 300; i++) {
          await new Promise((r) => setTimeout(r, 1000));
          try {
            const res = await fetch('https://api.wps.cn/office/v5/ai/skill_hub/wps_auth/exchange', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ code }),
              signal: AbortSignal.timeout(10000),
            });
            const j = await res.json().catch(() => null);
            const respCode = j?.code ?? j?.data?.code;
            const token = j?.data?.token ?? j?.token;
            if (respCode === 200 && token) {
              const cur = currentConfig();
              const idx = cur.connectors.findIndex((x) => x.serverName === serverName);
              if (idx >= 0) {
                STATE = { ...cur, connectors: cur.connectors.map((x, i2) => (i2 === idx ? { ...x, token } : x)) };
                await persist();
                await syncMounts();
              }
              AUTH_PENDING.set(serverName, { status: 'done' });
              log(`WPS 授权成功：${serverName} token 已写入并重挂`);
              return;
            }
            if (res.ok && respCode !== 202 && respCode !== undefined) {
              AUTH_PENDING.set(serverName, { status: 'error', error: `exchange 返回 ${respCode}` });
              return;
            }
          } catch { /* 瞬时错误继续轮询 */ }
        }
        AUTH_PENDING.set(serverName, { status: 'timeout' });
      })();
      return { ok: true, value: { loginUrl } };
    },

    'POST /auth/status': async (body) => {
      const serverName = String(body?.serverName ?? '');
      const rec = AUTH_PENDING.get(serverName);
      return { ok: true, value: rec ?? { status: 'idle' } };
    },

    /**
     * 微信 ClawBot 扫码登录（weixin-mcp）：
     * 拉取微信官方 ilinkai 二维码 → 生成 PNG（data URL）返回给前端展示；
     * 后台轮询扫码状态，确认后把凭证写入 ~/.weixin-mcp/accounts/（weixin-mcp 的凭证目录）。
     * 二维码过期自动换新码（status='refreshed' 附带新图片），前端无需重试。
     */
    'POST /wx-auth/start': async (body) => {
      const serverName = String(body?.serverName ?? 'weixin-mcp');
      const WX_BASE = 'https://ilinkai.weixin.qq.com';
      const ACCOUNTS_DIR = `${homedir()}/.weixin-mcp/accounts`;
      const genQr = async (url) => {
        const { default: QR } = await import('qrcode');
        return QR.toDataURL(url, { width: 360, margin: 2 });
      };
      const fetchQr = async () => {
        const res = await fetch(`${WX_BASE}/ilink/bot/get_bot_qrcode?bot_type=3`, { signal: AbortSignal.timeout(15000) });
        if (!res.ok) throw new Error(`get_bot_qrcode HTTP ${res.status}`);
        return res.json();
      };
      const pollQr = async (token) => {
        const res = await fetch(`${WX_BASE}/ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(token)}`, {
          headers: { 'iLink-App-ClientVersion': '1' },
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) throw new Error(`get_qrcode_status HTTP ${res.status}`);
        return res.json();
      };
      const saveAccount = (st) => {
        const accountId = String(st?.ilink_bot_id ?? '').replace('@', '-').replace('.', '-') || 'im-bot';
        mkdirSync(ACCOUNTS_DIR, { recursive: true });
        writeFileSync(`${ACCOUNTS_DIR}/${accountId}.json`, JSON.stringify({
          token: st.bot_token,
          baseUrl: st.baseurl ?? WX_BASE,
          ...(st.ilink_user_id ? { userId: st.ilink_user_id } : {}),
          savedAt: new Date().toISOString(),
        }, null, 2));
        return `${ACCOUNTS_DIR}/${accountId}.json`;
      };

      let first;
      try { first = await fetchQr(); } catch (e) {
        return { ok: false, error: { message: `获取微信登录二维码失败：${String(e?.message ?? e)}` } };
      }
      const { default: QR } = await import('qrcode');
      const image = await QR.toDataURL(first.qrcode_img_content, { width: 360, margin: 2 });
      WX_AUTH.set(serverName, { status: 'waiting', image });
      const stop = { cancelled: false };
      WX_AUTH_STOP.set(serverName, stop);
      (async () => {
        let qrToken = first.qrcode;
        let expiredCount = 0;
        for (let i = 0; i < 600 && !stop.cancelled; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          let st;
          try { st = await pollQr(qrToken); } catch { continue; }
          if (st.status === 'confirmed') {
            if (st.bot_token) {
              try {
                const file = saveAccount(st);
                WX_AUTH.set(serverName, { status: 'done', accountFile: file, userId: st.ilink_user_id ?? '' });
                // 若该连接器已保存，强制重挂（登录前 stdio 进程可能已启动失败）
                const cur = currentConfig();
                if (cur.connectors.some((x) => x.serverName === serverName)) {
                  await unmount(serverName, '微信扫码登录完成，重启 MCP 进程');
                  await syncMounts();
                }
                log(`微信扫码登录成功：${serverName} 凭证已写入`);
              } catch (e) {
                WX_AUTH.set(serverName, { status: 'error', error: `凭证写入失败：${String(e?.message ?? e)}` });
              }
            } else {
              WX_AUTH.set(serverName, { status: 'error', error: '确认响应中没有 bot_token' });
            }
            return;
          }
          if (st.status === 'expired') {
            expiredCount++;
            if (expiredCount > 5) { WX_AUTH.set(serverName, { status: 'timeout', error: '二维码多次过期，请重新点击扫码绑定' }); return; }
            try {
              const fresh = await fetchQr();
              qrToken = fresh.qrcode;
              WX_AUTH.set(serverName, { status: 'refreshed', image: await genQr(fresh.qrcode_img_content) });
            } catch { /* 拉新码失败下轮重试 */ }
            continue;
          }
        }
        if (!stop.cancelled && WX_AUTH.get(serverName)?.status !== 'done') {
          WX_AUTH.set(serverName, { status: 'timeout', error: '等待扫码超时，请重新点击扫码绑定' });
        }
      })();
      return { ok: true, value: { status: 'waiting', image } };
    },

    'POST /wx-auth/status': async (body) => {
      const serverName = String(body?.serverName ?? 'weixin-mcp');
      return { ok: true, value: WX_AUTH.get(serverName) ?? { status: 'idle' } };
    },

    'POST /wx-auth/cancel': async (body) => {
      const serverName = String(body?.serverName ?? 'weixin-mcp');
      const stop = WX_AUTH_STOP.get(serverName);
      if (stop) stop.cancelled = true;
      WX_AUTH.delete(serverName);
      return { ok: true, value: { cancelled: true } };
    },

    /** 桥接型连接器（如个人微信）：查询桥接机上的登录/绑定状态。 */
    'POST /bridge/status': async (body) => {
      // 支持未保存的草稿：直接用表单里的地址探测，找不到再回退已存储配置
      let c = null;
      try {
        c = sanitizeConnector(body?.connector);
        if (c.transport !== 'streamable-http') c = null;
      } catch { c = null; }
      if (!c) {
        const serverName = String(body?.serverName ?? '');
        const stored = currentConfig().connectors.find((x) => x.serverName === serverName);
        if (stored && stored.transport === 'streamable-http') c = stored;
      }
      if (!c || c.transport !== 'streamable-http') {
        return { ok: true, value: { ok: false, message: '请先填写类型为 streamable-http 的服务地址' } };
      }
      const headers = {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        ...(c.token ? { authorization: `Bearer ${c.token}` } : {}),
        ...(c.headers ?? {}),
      };
      const rpcCall = async (payload, sid) => {
        const res = await fetch(c.url, {
          method: 'POST',
          headers: sid ? { ...headers, 'mcp-session-id': sid } : headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.text();
        const line = raw.split('\n').find((l) => l.startsWith('data:'));
        return JSON.parse((line ? line.slice(5) : raw).trim());
      };
      try {
        const init = await rpcCall({
          jsonrpc: '2.0', id: 1, method: 'initialize',
          params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'mcp-connectors', version: '0.1.0' } },
        });
        const sid = init?.id !== undefined ? undefined : undefined; // sid 从响应头拿不到这里，改用无会话直调
        const list = await rpcCall({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
        const tools = list?.result?.tools ?? [];
        // 找登录状态类工具（不同桥命名不同：check_login_status / get_login_status / is_login…）
        const probe = tools.find((t) => /login|绑定|status/i.test(t?.name ?? ''));
        if (!probe) {
          return { ok: true, value: {
            ok: true, loggedIn: null,
            message: `桥已连接（${tools.length} 个工具），未找到登录状态工具；请在桥接机上完成微信登录后即可使用`,
            tools: tools.slice(0, 15).map((t) => t?.name).filter(Boolean),
          } };
        }
        const call = await rpcCall({
          jsonrpc: '2.0', id: 3, method: 'tools/call',
          params: { name: probe.name, arguments: {} },
        });
        const blocks = (call?.result?.content ?? []).filter((b) => b?.type === 'text').map((b) => b.text);
        const text = blocks.join('\n');
        const loggedIn = /(true|已登录|logged.?in|成功)/i.test(text) && !/(false|未登录|not.?logged|离线)/i.test(text);
        return { ok: true, value: { ok: true, loggedIn, message: text.slice(0, 400), tool: probe.name } };
      } catch (e) {
        return { ok: true, value: { ok: false, message: `无法连接桥接机：${String(e?.message ?? e).slice(0, 160)}` } };
      }
    },


    'POST /test': async (body) => {
      dbg('test: handler invoked (v2 with auth probe)');
      let c;
      try {
        c = sanitizeConnector(body?.connector);
      } catch (e) {
        return { ok: true, value: { ok: false, message: String(e?.message ?? e) } };
      }
      // 编辑器里 token 打码（●）或留空时，回退到已存储的 token
      if (!c.token && c.id) {
        const stored = currentConfig().connectors.find((x) => x.id === c.id || x.serverName === c.serverName);
        if (stored?.token) c.token = stored.token;
      }
      if (c.transport === 'wecom') {
        try {
          await wecomToken(c);
          const j = await wecomApi(c, '/cgi-bin/department/list', undefined);
          if (j?.errcode !== 0) {
            return { ok: true, value: { ok: false, message: `认证通过但查询失败：${j?.errmsg}（${j?.errcode}）` } };
          }
          return { ok: true, value: { ok: true, message: `连接成功：企业微信凭据有效，可访问 ${(j.department ?? []).length} 个部门` } };
        } catch (e) {
          return { ok: true, value: { ok: false, message: String(e?.message ?? e) } };
        }
      }
      if (c.transport !== 'streamable-http') {
        // stdio 不做握手探测（会拉起子进程），直接回报可保存
        return { ok: true, value: { ok: true, message: 'stdio 连接器不做预探测，保存后自动挂载' } };
      }
      const headers = {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        ...(c.token ? { authorization: `Bearer ${c.token}` } : {}),
        ...(c.headers ?? {}),
      };
      const rpc = async (payload, sessionHeader) => {
        const res = await fetch(c.url, {
          method: 'POST',
          headers: sessionHeader ? { ...headers, 'mcp-session-id': sessionHeader } : headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(15000),
        });
        return res;
      };
      try {
        const init = await rpc({
          jsonrpc: '2.0', id: 1, method: 'initialize',
          params: {
            protocolVersion: '2025-06-18',
            capabilities: {},
            clientInfo: { name: 'mcp-connectors-test', version: '0.1.0' },
          },
        });
        if (!init.ok) {
          const why = init.status === 401 || init.status === 403
            ? '鉴权失败：token 缺失或无效'
            : `端点返回 HTTP ${init.status}`;
          return { ok: true, value: { ok: false, message: `${why}（${init.status}）` } };
        }
        const sid = init.headers?.get?.('mcp-session-id') ?? undefined;
        // drain init body（SSE 或 JSON 都可能），只取 session id
        try { await init.text(); } catch { /* ignore */ }
        const inited = await rpc({ jsonrpc: '2.0', method: 'notifications/initialized' }, sid);
        try { await inited.text(); } catch { /* ignore */ }
        const list = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }, sid);
        const raw = await list.text();
        if (!list.ok) {
          return { ok: true, value: { ok: false, message: `握手成功但 tools/list 返回 ${list.status}` } };
        }
        // 解析 JSON 或 SSE 里的 data: 行
        let tools = [];
        try {
          let jsonText = raw;
          const dataLine = raw.split('\n').find((l) => l.startsWith('data:'));
          if (dataLine) jsonText = dataLine.slice(5).trim();
          const parsed = JSON.parse(jsonText);
          tools = parsed?.result?.tools ?? [];
        } catch { /* keep empty */ }

        // 有些端点允许匿名列出工具，鉴权只在调用时检查：
        // 尝试一个廉价只读工具验证 token 真实有效（无该工具则跳过此步）。
        const probeName = tools.find((t) => t?.name === 'get_user_info')
          ?? tools.find((t) => /(^|\.)(whoami|me|user_info)$/i.test(t?.name ?? ''));
        dbg(`test: probe candidate=${probeName?.name ?? '(none)'}, tools=${tools.length}`);
        if (probeName) {
          try {
            // /test 的本地 rpc 返回 Response 对象（不抛错），按 Response 语义判断
            const callRes = await rpc({
              jsonrpc: '2.0', id: 3, method: 'tools/call',
              params: { name: probeName.name, arguments: {} },
            }, sid);
            dbg(`test: probe call status=${callRes.status}`);
            if (!callRes.ok) {
              const why = callRes.status === 401 || callRes.status === 403
                ? 'token 无效或缺失（调用被拒绝）'
                : `调用返回 HTTP ${callRes.status}`;
              return { ok: true, value: { ok: false, message: why } };
            }
            const callText = await callRes.text();
            let parsed = null;
            try {
              const line = callText.split('\n').find((l) => l.startsWith('data:'));
              parsed = JSON.parse((line ? line.slice(5) : callText).trim());
            } catch { /* ignore */ }
            if (parsed?.result?.isError) {
              const firstErr = (parsed.result.content ?? []).find((b) => b?.type === 'text');
              const t1 = firstErr?.text ?? '';
              if (/401|unauthorized|invalid.*token|鉴权|permission/i.test(t1)) {
                return { ok: true, value: { ok: false, message: `token 无效或权限不足：${t1.slice(0, 120)}` } };
              }
            }
          } catch (e) {
            // 探针异常不阻塞“连接成功”的结论
          }
        }
        return {
          ok: true,
          value: {
            ok: true,
            message: `连接成功，发现 ${tools.length} 个工具`,
            tools: tools.slice(0, 20).map((t) => t?.name).filter(Boolean),
          },
        };
      } catch (e) {
        const msg = e?.name === 'TimeoutError' ? '连接超时（15s）' : String(e?.message ?? e);
        return { ok: true, value: { ok: false, message: `无法连接：${msg}` } };
      }
    },
  };

  ctx.effect(() => {
    const off = ctx.on('agent/created', (agent) => applyGate(agent));
    // 工具注册与 agent ctx 就绪都可能晚于 agent/created：周期性全量重刷（幂等，deny 未变不重建），
    // 确保任何时序下门控最终收敛，不会因某次 skip 而永久失效
    const gateRetry = setInterval(() => {
      for (const agent of AGENTS?.list?.() ?? []) applyGate(agent);
    }, 3000);
    ctx.effect(() => {
      for (const agent of ctx.agents?.list?.() ?? []) applyGate(agent);
      return () => {
        clearInterval(gateRetry);
        for (const d of RESTRICTORS.values()) { try { d(); } catch { /* ignore */ } }
        RESTRICTORS.clear();
        LAST_DENY.clear();
      };
    }, 'mcp-connectors: agent gate cleanup');
    return off;
  }, 'mcp-connectors: agent gating');

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: ROUTE,
    handler: async (req, res) => {
      const url = req.url ?? '/';
      const path = url.split('?')[0].slice(ROUTE.length) || '/';
      const key = `${req.method ?? 'GET'} ${path}`;
      const handle = handlers[key];
      if (!handle) {
        sendJson(res, 404, { ok: false, error: { message: `no route ${key}` } });
        return;
      }
      try {
        const body = req.method === 'POST' ? await readJsonBody(req) : undefined;
        sendJson(res, 200, await handle(body));
      } catch (e) {
        const msg = e?.message === 'payload-too-large' ? '请求体过大' : String(e?.message ?? e);
        sendJson(res, 400, { ok: false, error: { message: msg } });
      }
    },
  }), 'mcp-connectors: http route');

  // 插件停用/重启时：停掉守护轮询与 stdio 子进程，避免僵尸循环
  // （旧实例残留的轮询器会继续用旧配置抢消息，且其内部访问已失效）
  ctx.effect(() => () => {
    for (const sn of [...WX_POLLERS.keys()]) stopWeixinPoller(sn);
    for (const cl of [...STDIO_CLIENTS.values()]) { try { cl.dispose(); } catch { /* ignore */ } }
    dbg('plugin teardown: pollers stopped, stdio clients disposed');
  }, 'mcp-connectors: weixin poller cleanup');

  // 启动收敛（不阻塞插件激活）
  syncMounts().catch((e) => warn('启动挂载收敛失败：', e?.message ?? e));
  log('MCP 连接器中心已就绪', `(${ROUTE})`);
}
