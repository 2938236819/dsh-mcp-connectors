/**
 * @wfm-cn/dsh-mcp-connectors — MCP 连接器中心（Client 侧）
 *
 *  ┌─ 结构说明（工程化：连接器注册表模式）──────────────────────────┐
 *  │ 每个连接器 = CONNECTOR_DEFS 里一个完全自包含的定义对象：       │
 *  │   id / icon / labelKey / descKey / template / renderAuth()      │
 *  │ 新增连接器只需 append 一个定义，不改任何现有连接器与框架代码。  │
 *  │ 框架（Tab 页 / 卡片 / 编辑器 / 保存）只读注册表，互不干扰。     │
 *  └────────────────────────────────────────────────────────────────┘
 *
 *  - sidebar.panellist 图标 + `main` 面板页：
 *      顶部两个 Tab：「全部」（目录卡片，点开查看+创建）、「已安装」（管理已创建的连接器）；
 *  - conversation.input.left 会话内连接器选择下拉（按会话生效）；
 *  - 所有 Host 交互走 HTTP API（fetch /mcp-connectors/*）。
 */
window.__ModuleLoader__.load({
  id: '@wfm-cn/dsh-mcp-connectors',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useMemo, useRef, useCallback } = React;

    const PANEL_ID = 'mcp-connectors';
    const NS = 'mcp-connectors';

    const DICTS = {
      zh: {
        panelTitle: '连接器',
        panelDesc: '统一管理 MCP 连接器：添加、授权凭据、启停，并在会话中选择启用。',
        tabAll: '全部',
        tabInstalled: '已安装',
        add: '添加连接器',
        empty: '还没有连接器。切到「全部」标签页，选一个开始。',
        emptyInstalled: '还没有已安装的连接器。到「全部」标签页点击卡片即可创建。',
        goAllTab: '去「全部」看看 →',
        enabled: '已启用',
        disabled: '已停用',
        mounted: '已连接',
        notMounted: '未连接',
        edit: '编辑',
        del: '删除',
        confirmDelete: '确定删除该连接器？',
        installedBadge: '已安装',
        viewAndCreate: '查看并创建',
        connectorInfo: '连接器说明',
        fieldTitle: '名称',
        fieldType: '类型（固定）',
        fieldServerName: '标识（serverName）',
        fieldTransport: '类型',
        fieldUrl: '服务地址（URL）',
        fieldCommand: '命令（command）',
        fieldArgs: '参数（每行一个）',
        fieldToken: '访问令牌（token）',
        getTokenHint: 'Token 说明文档 ↗',
        githubHint: 'GitHub 官方流程：点击下方按钮创建 Personal Access Token（勾选你需要的仓库/权限），复制后粘贴到上方输入框。Token 只保存在本机。',
        githubCreateBtn: '去 GitHub 创建 Token ↗',
        authWps: '去 WPS 授权登录（自动获取 Token）',
        authWaiting: '等待你在浏览器中完成授权…',
        authOpening: '正在发起授权…',
        authDone: '授权成功，Token 已保存并生效',
        authHint: '金山文档使用 WPS 授权登录，无需手动粘贴 token。',
        authNeedName: '请先填写标识（serverName）',
        wxBindBtn: '扫码绑定微信',
        wxBindDoneShort: '✓ 微信已绑定',
        wxBindDone: '绑定成功！微信 ClawBot 凭证已保存，工具已挂载',
        wxWaitingScan: '等待扫码…',
        wxScanHint: '请用手机微信扫码并确认登录',
        wxConfirmOnPhone: '已扫码，请在手机上确认登录…',
        wxBindTimeout: '绑定未完成，请重新点击扫码绑定',
        presetWechat: '微信 (ClawBot)',
        presetChrome: '谷歌浏览器（Chrome DevTools · 本机运行）',
        chromeHint: '无需令牌。保存后自动通过 npx 启动 chrome-devtools-mcp 并连接本机谷歌浏览器；首次使用请确保已安装 Chrome。',
        testConn: '测试连接',
        testing: '测试中',
        fieldEnv: '环境变量（每行 KEY=value）',
        fieldNote: '备注',
        save: '保存',
        cancel: '取消',
        addMenuTitle: '选择类型',
        presetTencentDocs: '腾讯文档（官方 MCP）',
        presetKdocs: '金山文档（WPS 云文档 MCP）',
        presetGithub: 'GitHub（官方 MCP · 需 Personal Access Token）',
        presetCustom: '自定义 / 其他 MCP 服务',
        descTencentDocs: '腾讯文档官方 MCP：读写在线文档、智能表格，需在官网开通并获取 token。',
        descKdocs: '金山文档（WPS 云文档）官方 MCP：通过 WPS 账号授权登录，无需手动粘贴 token。',
        descGithub: 'GitHub 官方 MCP：操作仓库、Issue、PR，需要 Personal Access Token（fine-grained）。',
        descWechat: '微信 ClawBot：扫码绑定个人微信后，可在指定会话里自动回复消息、收发文件。',
        descChrome: 'Chrome DevTools MCP：本机运行的浏览器控制连接器，可打开页面、点击、截图、抓网络请求，无需令牌。',
        descCustom: '任意 MCP 服务：粘贴 JSON 配置一键填充，或手动填写字段；不做过多的限制，想怎么填就怎么填。',
        jsonPasteTitle: '粘贴 JSON 快速填充（可选）',
        jsonPastePlaceholder: '支持 mcpServers 配置，例如：\n\n{\n  "my-server": {\n    "command": "npx",\n    "args": ["-y", "some-mcp-server"],\n    "env": { "API_KEY": "xxx" }\n  }\n}\n\n或 HTTP 型：\n\n{ "my-server": { "url": "https://example.com/mcp", "headers": { "Authorization": "Bearer xxx" } } }',
        jsonParseBtn: '解析并填充 ↓',
        jsonParseOk: '✓ 已填充：',
        jsonParseFail: '✕ 解析失败：',
        composerOpen: '连接器',
        selectAll: '全选',
        deselectAll: '全部取消',
        loadFailed: '加载失败',
        retry: '重试',
        hint: '工具将以 mcp__<标识>__<工具名> 出现在会话中。',
      },
      en: {
        panelTitle: 'Connectors',
        panelDesc: 'Manage MCP connectors: add, authorize, toggle, and pick per conversation.',
        tabAll: 'All',
        tabInstalled: 'Installed',
        add: 'Add connector',
        empty: 'No connectors yet. Open the "All" tab and pick one.',
        emptyInstalled: 'Nothing installed yet. Click a card in the "All" tab to create one.',
        goAllTab: 'Browse the "All" tab →',
        enabled: 'Enabled',
        disabled: 'Disabled',
        mounted: 'Connected',
        notMounted: 'Not connected',
        edit: 'Edit',
        del: 'Delete',
        confirmDelete: 'Delete this connector?',
        installedBadge: 'Installed',
        viewAndCreate: 'View & create',
        connectorInfo: 'About this connector',
        fieldTitle: 'Title',
        fieldType: 'Type (fixed)',
        fieldServerName: 'Server name',
        fieldTransport: 'Transport',
        fieldUrl: 'Endpoint URL',
        fieldCommand: 'Command',
        fieldArgs: 'Arguments (one per line)',
        fieldToken: 'Access token',
        getTokenHint: 'Token guide ↗',
        githubHint: 'Official GitHub flow: click the button below to create a Personal Access Token (select the repos/permissions you need), copy and paste it above. Stored locally only.',
        githubCreateBtn: 'Create a Token on GitHub ↗',
        authWps: 'Authorize via WPS login (fetches token automatically)',
        authWaiting: 'Waiting for authorization in your browser…',
        authOpening: 'Starting authorization…',
        authDone: 'Authorized. Token saved and mounted',
        authHint: 'Kingsoft Docs uses WPS OAuth login — no manual token needed.',
        authNeedName: 'Fill in the server name first',
        wxBindBtn: 'Bind WeChat via QR',
        wxBindDoneShort: '✓ WeChat bound',
        wxBindDone: 'Bound! WeChat ClawBot credentials saved and tools mounted',
        wxWaitingScan: 'Waiting for scan…',
        wxScanHint: 'Scan with WeChat on your phone and confirm',
        wxConfirmOnPhone: 'Scanned — confirm login on your phone…',
        wxBindTimeout: 'Not completed. Click the button to try again',
        presetWechat: 'WeChat (ClawBot)',
        presetChrome: 'Google Chrome (Chrome DevTools · local)',
        chromeHint: 'No token needed. Saving launches chrome-devtools-mcp via npx and connects to your local Chrome; make sure Chrome is installed.',
        testConn: 'Test connection',
        testing: 'Testing',
        fieldEnv: 'Environment variables (KEY=value per line)',
        fieldNote: 'Note',
        save: 'Save',
        cancel: 'Cancel',
        addMenuTitle: 'Choose a type',
        presetTencentDocs: 'Tencent Docs (official MCP)',
        presetKdocs: 'Kingsoft Docs (WPS cloud MCP)',
        presetGithub: 'GitHub (official MCP · needs a Personal Access Token)',
        presetCustom: 'Custom MCP server',
        descTencentDocs: 'Official Tencent Docs MCP: read/write online docs and smart sheets. Requires a token from the official site.',
        descKdocs: 'Official Kingsoft Docs (WPS) MCP: authorize with your WPS account — no manual token.',
        descGithub: 'Official GitHub MCP: repos, issues, PRs. Requires a fine-grained Personal Access Token.',
        descWechat: 'WeChat ClawBot: bind your personal WeChat via QR, then auto-reply messages in a chosen session.',
        descChrome: 'Chrome DevTools MCP: local browser-control connector — navigate, click, screenshot, inspect network. No token.',
        descCustom: 'Any MCP server: paste a JSON config to auto-fill, or fill fields manually. Kept loose on purpose.',
        jsonPasteTitle: 'Paste JSON to auto-fill (optional)',
        jsonPastePlaceholder: 'mcpServers-style config, e.g.:\n\n{ "my-server": { "command": "npx", "args": ["-y", "some-mcp-server"], "env": { "API_KEY": "xxx" } } }\n\nor HTTP:\n\n{ "my-server": { "url": "https://example.com/mcp", "headers": { "Authorization": "Bearer xxx" } } }',
        jsonParseBtn: 'Parse & fill ↓',
        jsonParseOk: '✓ Filled: ',
        jsonParseFail: '✕ Parse failed: ',
        composerOpen: 'Connectors',
        selectAll: 'Select all',
        deselectAll: 'Deselect all',
        loadFailed: 'Failed to load',
        retry: 'Retry',
        hint: 'Tools appear as mcp__<server>__<tool> in conversations.',
      },
    };

    /* ================= 通用小部件（与具体连接器无关） ================= */

    function Switch({ checked, onChange, title }) {
      return h('button', {
        type: 'button', role: 'switch', 'aria-checked': String(checked), title,
        className: 'mcx-switch' + (checked ? ' mcx-switch-on' : ''),
        onClick: (e) => { e.stopPropagation(); onChange(!checked); },
      }, h('span', { className: 'mcx-switch-knob' }));
    }

    function Field({ label, children }) {
      return h('label', { className: 'mcx-field' },
        h('span', { className: 'mcx-field-label' }, label), children);
    }

    const inputCls = 'mcx-input';

    /* ================= 微信相关组件（仅供 wechat 连接器使用） ================= */

    /** 微信自动回复的绑定会话选择器：可搜索，默认只显示前几条。 */
    function WechatSessionPicker({ t, api, value, onChange }) {
      const [sessions, setSessions] = useState([]);
      const [loadErr, setLoadErr] = useState('');
      const [query, setQuery] = useState('');
      const [open, setOpen] = useState(false);
      const load = () => api.listSessions().then((r) => {
        if (r.ok) { setSessions(r.value ?? []); setLoadErr(''); }
        else setLoadErr('✕ ' + (r.error?.message ?? '加载会话列表失败'));
      }).catch((e) => setLoadErr('✕ ' + String(e?.message ?? e)));
      useEffect(() => { load(); }, []);

      const wsName = (s) => {
        const cwd = String(s.cwd ?? '');
        if (!cwd) return s.live ? '（活跃）' : '';
        const parts = cwd.split(/[\\/]/).filter(Boolean);
        return parts[parts.length - 1] ?? cwd;
      };
      const label = (s) => s.title || s.id;
      const selected = sessions.find((s) => s.id === value);
      const q = query.trim().toLowerCase();
      const filtered = q
        ? sessions.filter((s) => `${s.title} ${s.id} ${wsName(s)}`.toLowerCase().includes(q))
        : sessions;
      const shown = filtered.slice(0, 6);

      return h('div', { className: 'mcx-auth-hint' },
        h(Field, { label: '自动回复会话（微信消息将注入该会话，AI 基于它的上下文回复）' },
          selected && !open
            ? h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
                h('div', {
                  className: inputCls, style: { flex: 1, cursor: 'pointer' },
                  onClick: () => setOpen(true),
                }, `💬 ${label(selected)} · ${wsName(selected)}`),
                h('button', { type: 'button', className: 'mcx-btn', onClick: () => { onChange(''); setOpen(true); } }, '更改'))
            : h('div', null,
                h('input', {
                  className: inputCls, placeholder: '🔍 输入标题/工作区搜索会话…', value: query,
                  onChange: (e) => { setQuery(e.target.value); setOpen(true); },
                  onFocus: () => setOpen(true),
                }),
                open && h('div', {
                  style: { border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', marginTop: '4px', maxHeight: '240px', overflowY: 'auto', position: 'relative', zIndex: 10, background: 'inherit' },
                },
                  shown.length === 0
                    ? h('div', { style: { padding: '8px', opacity: 0.6, fontSize: '13px' } }, q ? '没有匹配的会话' : '没有会话')
                    : shown.map((s) => h('button', {
                        key: s.id,
                        type: 'button',
                        className: 'mcx-add-menu-item',
                        style: { display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.06)' },
                        onMouseDown: (e) => { e.preventDefault(); },
                        onClick: () => { onChange(s.id); setOpen(false); setQuery(''); },
                      },
                        h('div', null, `${s.live ? '🟢 ' : ''}${label(s)}`),
                        h('div', { style: { fontSize: '12px', opacity: 0.6 } }, wsName(s) + (s.title ? ` · ${s.id.slice(-8)}` : '')))),
                  filtered.length > shown.length
                    ? h('div', { style: { padding: '6px 10px', opacity: 0.6, fontSize: '12px' } }, `还有 ${filtered.length - shown.length} 条，请继续输入缩小范围（共 ${filtered.length} 条）`)
                    : null)),
          h('div', { style: { marginTop: '4px', display: 'flex', gap: '8px', alignItems: 'center' } },
            h('button', { type: 'button', className: 'mcx-btn', style: { fontSize: '12px' }, onClick: load }, '↻ 刷新会话列表'),
            sessions.length > 0 ? h('span', { style: { fontSize: '12px', opacity: 0.7 } }, `共 ${sessions.length} 个会话`) : null,
            value && !open ? h('span', { style: { fontSize: '12px', opacity: 0.5 } }, `已绑定 …${value.slice(-8)}`) : null),
          loadErr && h('div', { className: 'mcx-error' }, loadErr)),
      );
    }

    /** 微信 ClawBot 扫码绑定：按钮 → 对话框内二维码 → 轮询状态 → 绑定完成。 */
    function WechatQrAuth({ t, api, onSaved, onSave, busy, setBusy, msg, setMsg, isNew, initialServerName }) {
      const [qr, setQr] = useState('');       // 二维码 PNG data URL
      const [phase, setPhase] = useState('idle'); // idle | waiting | scaned | done | fail
      const runRef = useRef(0);
      const start = async () => {
        const run = ++runRef.current;
        setBusy(true); setMsg(''); setPhase('waiting'); setQr('');
        try {
          const r = await api.wxAuthStart({ serverName: initialServerName || 'weixin-mcp' });
          if (!r.ok) { setPhase('fail'); setMsg('✕ ' + (r.error?.message ?? 'failed')); setBusy(false); return; }
          setQr(r.value.image);
          for (let i = 0; i < 600; i++) {
            await new Promise((res) => setTimeout(res, 2000));
            if (runRef.current !== run) return;
            const st = await api.wxAuthStatus({ serverName: initialServerName || 'weixin-mcp' });
            if (!st.ok) continue;
            const v = st.value ?? {};
            if (v.status === 'refreshed' && v.image) { setQr(v.value?.image ?? v.image); setPhase('waiting'); setMsg(''); }
            else if (v.status === 'waiting' && v.image && !qr) setQr(v.image);
            else if (v.status === 'scaned') { setPhase('scaned'); setMsg(t('wxConfirmOnPhone')); }
            else if (v.status === 'done') {
              setPhase('done'); setMsg('✓ ' + t('wxBindDone')); setBusy(false);
              try { await onSave?.(); } catch { /* 保存失败不掩盖绑定成功 */ }
              await onSaved?.();
              return;
            }
            else if (v.status === 'error' || v.status === 'timeout') { setPhase('fail'); setMsg('✕ ' + (v.error ?? v.status)); setBusy(false); return; }
          }
          setPhase('fail'); setMsg('✕ ' + t('wxBindTimeout')); setBusy(false);
        } catch (e) {
          setPhase('fail'); setMsg('✕ ' + String(e?.message ?? e)); setBusy(false);
        }
      };
      return h('div', { className: 'mcx-auth-hint' },
        h('button', {
          type: 'button', className: 'mcx-btn mcx-auth-btn', disabled: busy,
          onClick: start,
        }, phase === 'done' ? t('wxBindDoneShort') : (busy ? t('wxWaitingScan') : t('wxBindBtn'))),
        phase === 'waiting' || phase === 'scaned'
          ? h('div', { style: { marginTop: '10px', textAlign: 'center' } },
              qr && h('img', { src: qr, alt: 'WeChat QR', style: { width: '220px', height: '220px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)' } }),
              h('div', { style: { marginTop: '6px', opacity: 0.8 } }, phase === 'scaned' ? t('wxConfirmOnPhone') : t('wxScanHint')))
          : null,
        msg && h('div', { className: 'mcx-test-result ' + (msg.startsWith('✓') ? 'mcx-test-ok' : 'mcx-auth-msg') }, msg),
      );
    }

    /* ================================================================
     * 连接器注册表（核心隔离机制）
     *
     * 每个连接器一个完全自包含的定义对象。新增连接器 = 在这里 append
     * 一项，不动任何其他代码；某个连接器的 renderAuth 写坏了也只
     * 影响它自己的表单区，框架与其它连接器不受影响。
     *
     * def 字段：
     *   id         注册表内唯一 id（存量数据里的 type 值）
     *   icon       目录卡片图标（emoji）
     *   labelKey   名称文案 key（DICTS）
     *   descKey    说明文案 key（DICTS）
     *   template   新建时的默认 draft（serverName/transport/url/...）
     *   renderAuth(ui) -> 节点 | null   该连接器特有的表单区
     *     ui = { h, Field, inputCls, t, api, draft, set, setDraft,
     *            initial, onSaved, doSave, busy, setBusy }
     *   lockTemplate  预设是否锁定 serverName/transport 等技术字段
     * ================================================================ */
    const CONNECTOR_DEFS = [
      {
        id: 'tencent-docs',
        icon: '📄',
        labelKey: 'presetTencentDocs',
        descKey: 'descTencentDocs',
        lockTemplate: true,
        template: {
          title: '腾讯文档', serverName: 'tencent-docs', transport: 'streamable-http',
          url: 'https://docs.qq.com/openapi/mcp',
          helpUrl: 'https://docs.qq.com/scenario/open-claw.html',
        },
        renderAuth: ({ h: H, Field: F, inputCls: ic, t, draft, set, initial }) => H(React.Fragment, null,
          H(F, { label: t('fieldToken') },
            H('input', { className: ic, type: 'password', value: draft.token === '●' ? '' : draft.token ?? '', onChange: set('token'), placeholder: initial?.token === '●' ? '已保存 · 留空保持不变' : '粘贴 token 或整条安装指令均可' })),
          H('a', {
            className: 'mcx-token-link',
            href: 'https://docs.qq.com/scenario/open-claw.html',
            target: '_blank', rel: 'noreferrer',
          }, t('getTokenHint'))),
      },
      {
        id: 'kdocs',
        icon: '📊',
        labelKey: 'presetKdocs',
        descKey: 'descKdocs',
        lockTemplate: true,
        template: {
          title: '金山文档', serverName: 'kdocs-wps', transport: 'streamable-http',
          url: 'https://mcp-center.wps.cn/skill_hub/mcp',
          auth: 'wps',
        },
        renderAuth: ({ h: H, t, api, draft, initial, onSaved, setAuthMsg }) => H('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
          H('button', {
            type: 'button', className: 'mcx-btn mcx-auth-btn',
            onClick: async () => {
              const sn = draft.serverName || initial?.serverName;
              if (!sn) { setAuthMsg('✕ ' + t('authNeedName')); return; }
              setAuthMsg(t('authOpening'));
              try {
                const r = await api.authStart({ serverName: sn });
                if (!r.ok) { setAuthMsg('✕ ' + (r.error?.message ?? 'failed')); return; }
                window.open(r.value.loginUrl, '_blank', 'noopener');
                for (let i = 0; i < 150; i++) {
                  await new Promise((res2) => setTimeout(res2, 2000));
                  const st = await api.authStatus({ serverName: sn });
                  if (st.ok && st.value.status === 'done') { setAuthMsg('✓ ' + t('authDone')); await onSaved?.(); break; }
                  if (st.ok && (st.value.status === 'error' || st.value.status === 'timeout')) { setAuthMsg('✕ ' + (st.value.error ?? st.value.status)); break; }
                }
              } catch (e2) { setAuthMsg('✕ ' + String(e2?.message ?? e2)); }
            },
          }, t('authWps')),
          H('div', { className: 'mcx-auth-hint' }, t('authHint'))),
      },
      {
        id: 'github',
        icon: '🐙',
        labelKey: 'presetGithub',
        descKey: 'descGithub',
        lockTemplate: true,
        template: {
          title: 'GitHub', serverName: 'github', transport: 'streamable-http',
          url: 'https://api.githubcopilot.com/mcp/',
          helpUrl: 'https://github.com/settings/personal-access-tokens',
        },
        renderAuth: ({ h: H, Field: F, inputCls: ic, t, draft, set, initial }) => H(React.Fragment, null,
          H(F, { label: t('fieldToken') },
            H('input', { className: ic, type: 'password', value: draft.token === '●' ? '' : draft.token ?? '', onChange: set('token'), placeholder: initial?.token === '●' ? '已保存 · 留空保持不变' : 'github_pat_…' })),
          H('a', {
            className: 'mcx-btn mcx-auth-btn mcx-token-link',
            href: 'https://github.com/settings/personal-access-tokens',
            target: '_blank', rel: 'noreferrer',
          }, t('githubCreateBtn')),
          H('div', { className: 'mcx-auth-hint' }, t('githubHint'))),
      },
      {
        id: 'wechat',
        icon: '💬',
        labelKey: 'presetWechat',
        descKey: 'descWechat',
        lockTemplate: true,
        template: {
          title: '微信 (ClawBot)', serverName: 'weixin-mcp', transport: 'stdio',
          command: 'npx', args: ['-y', 'weixin-mcp'],
          auth: 'wxqr',
        },
        renderAuth: ({ h: H, t, api, draft, setDraft, initial, onSaved, doSave, busy, setBusy, setAuthMsg }) => H(React.Fragment, null,
          H(WechatSessionPicker, { t, api, value: draft.targetSession ?? '', onChange: (v) => setDraft((d) => ({ ...d, targetSession: v })) }),
          H(WechatQrAuth, {
            t, api, onSaved, onSave: () => doSave(false), busy, setBusy,
            msg: authMsg, setMsg: setAuthMsg, isNew: !initial?.id, initialServerName: initial?.serverName,
          })),
      },
      {
        id: 'chrome',
        icon: '🌐',
        labelKey: 'presetChrome',
        descKey: 'descChrome',
        lockTemplate: true,
        template: {
          title: '谷歌浏览器', serverName: 'chrome-devtools', transport: 'stdio',
          command: 'npx', args: ['-y', 'chrome-devtools-mcp@latest'],
        },
        renderAuth: ({ h: H, t }) =>
          H('div', { className: 'mcx-auth-hint' }, t('chromeHint')),
      },
      {
        id: 'custom',
        icon: '⚙️',
        labelKey: 'presetCustom',
        descKey: 'descCustom',
        lockTemplate: false, // 自定义：一切放开
        template: { title: '', serverName: '', transport: 'streamable-http', url: '' },
        renderAuth: null, // 自定义的字段由编辑器统一渲染（JSON 粘贴 + 全字段）
      },
    ];
    const DEF_BY_ID = Object.fromEntries(CONNECTOR_DEFS.map((d) => [d.id, d]));

    /** 按端点 URL 匹配已知预设的 token 帮助页（编辑旧连接器也显示正确链接）。 */
    const HELP_URL_BY_ENDPOINT = {
      'https://docs.qq.com/openapi/mcp': 'https://docs.qq.com/scenario/open-claw.html',
      'https://api.githubcopilot.com/mcp/': 'https://github.com/settings/personal-access-tokens',
    };
    /** 由 serverName/url 推断连接器类型（兼容存量数据）；返回 undefined 表示自定义。 */
    function inferType(c) {
      if (!c) return undefined;
      if (c.type && DEF_BY_ID[c.type]) return c.type;
      const sn = String(c.serverName ?? '');
      const url = String(c.url ?? '');
      if (sn === 'chrome-devtools' || /chrome-devtools-mcp/.test(`${c.command ?? ''} ${(c.args ?? []).join(' ')}`)) return 'chrome';
      if (c.auth === 'wxqr' || sn === 'weixin-mcp') return 'wechat';
      if (c.auth === 'wps' || sn === 'kdocs-wps' || /mcp-center\.wps\.cn/.test(url)) return 'kdocs';
      if (c.auth === 'pat' || sn === 'github' || /api\.githubcopilot\.com/.test(url)) return 'github';
      if (sn === 'tencent-docs' || /docs\.qq\.com\/openapi\/mcp/.test(url)) return 'tencent-docs';
      return undefined;
    }

    /* ================= JSON 粘贴解析（仅自定义连接器使用） ================= */

    /**
     * 宽松解析用户粘贴的 JSON，提取一个 MCP server 配置：
     *  - { mcpServers: { name: {...} } }（标准 Claude/DSH 配置）
     *  - { name: {...} }（单键，值形如 server 配置）
     *  - 直接一个 server 配置对象（含 command 或 url）
     * 返回 { name, server }；不认识则抛错。
     */
    function parseMcpJson(text) {
      const raw = String(text ?? '').trim();
      if (!raw) throw new Error('empty');
      let obj;
      try { obj = JSON.parse(raw); } catch (e) { throw new Error('不是合法 JSON：' + (e?.message ?? e)); }
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('JSON 根必须是对象');
      let root = obj;
      if (root.mcpServers && typeof root.mcpServers === 'object') root = root.mcpServers;
      const looksLikeServer = (v) => v && typeof v === 'object'
        && (typeof v.url === 'string' || typeof v.command === 'string');
      if (looksLikeServer(root)) return { name: '', server: root };
      const entries = Object.entries(root).filter(([, v]) => looksLikeServer(v));
      if (entries.length === 0) throw new Error('没有找到形如 { "名称": { url|command: ... } } 的 server 配置');
      const [name, server] = entries[0];
      return { name, server };
    }

    /* ================= 连接器编辑器（由 def 驱动的通用表单） ================= */

    function ConnectorEditor({ initial, t, api, onSave, onDelete, onTest, onSaved, onClose }) {
      const [draft, setDraft] = useState(() => ({
        title: '', serverName: '', transport: 'streamable-http', url: '', token: '',
        command: '', argsText: '', envText: '', note: '', enabled: true,
        ...(initial && initial.env ? { envText: Object.entries(initial.env).map(([k, v]) => `${k}=${v}`).join('\n') } : {}),
        ...(initial && initial.args ? { argsText: initial.args.join('\n') } : {}),
        ...(initial ?? {}),
      }));
      const [busy, setBusy] = useState(false);
      const [err, setErr] = useState('');
      const [testing, setTesting] = useState(false);
      const [testResult, setTestResult] = useState('');
      const [authBusy, setAuthBusy] = useState(false);
      const [authMsg, setAuthMsg] = useState('');
      const [jsonText, setJsonText] = useState('');
      const [jsonMsg, setJsonMsg] = useState('');
      const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));
      const isNew = !initial?.id;

      // 类型：预设 id / undefined（自定义）
      const ctype = inferType({ ...draft, ...initial });
      const def = ctype ? DEF_BY_ID[ctype] ?? DEF_BY_ID.custom : DEF_BY_ID.custom;
      const isPreset = Boolean(ctype && def.id !== 'custom');
      const isCustom = !isPreset;

      const doSave = async (closeAfter = true) => {
        setBusy(true); setErr('');
        try {
          const connector = {
            ...draft,
            id: initial?.id,
            type: isPreset ? def.id : undefined,
            title: draft.title, serverName: draft.serverName, transport: draft.transport,
            note: draft.note, enabled: draft.enabled !== false,
          };
          if (isPreset && def.lockTemplate) {
            // 预设类型：技术字段以模板为准，用户可改名称、token、备注
            const tpl = def.template;
            connector.serverName = tpl.serverName;
            connector.transport = tpl.transport;
            if (tpl.url) connector.url = tpl.url;
            if (tpl.auth) connector.auth = tpl.auth;
            if (tpl.command) connector.command = tpl.command;
            if (tpl.args) connector.args = tpl.args;
          }
          if (connector.transport === 'stdio') {
            // stdio：优先保留预设 args；自定义则用文本框逐行解析
            connector.command = draft.command || def.template?.command || '';
            if (isPreset && def.template?.args) connector.args = def.template.args;
            else connector.args = String(draft.argsText ?? '').split('\n').map((x) => x.trim()).filter(Boolean);
            connector.env = Object.fromEntries(
              String(draft.envText ?? '').split('\n').map((l) => l.trim())
                .filter((l) => l && l.includes('='))
                .map((l) => { const eq = l.indexOf('='); return [l.slice(0, eq).trim(), l.slice(eq + 1).trim()]; }));
            delete connector.url; delete connector.token;
          } else {
            connector.url = draft.url; connector.token = draft.token;
            if (draft.headers) connector.headers = draft.headers;
            delete connector.command; delete connector.args;
          }
          if (initial?.token === '●' && !connector.token) connector.token = '●'; // 未改动时保留
          await onSave(connector);
          if (closeAfter) onClose();
          return true;
        } catch (e2) {
          setErr(String(e2?.error?.message ?? e2?.message ?? e2));
        } finally { setBusy(false); }
        return false;
      };
      const submit = (e) => { e.preventDefault(); doSave(); };

      /** 自定义：JSON 粘贴 → 宽松填充 draft */
      const applyJson = () => {
        setJsonMsg('');
        try {
          const { name, server } = parseMcpJson(jsonText);
          const next = { ...draft };
          if (name) { next.serverName = next.serverName || String(name).replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 32) || next.serverName; next.title = next.title || String(name); }
          if (typeof server.url === 'string') { next.transport = 'streamable-http'; next.url = server.url; }
          if (typeof server.command === 'string') {
            next.transport = 'stdio'; next.command = server.command;
            if (Array.isArray(server.args)) next.argsText = server.args.map(String).join('\n');
          }
          if (server.env && typeof server.env === 'object') {
            next.envText = Object.entries(server.env).map(([k, v]) => `${k}=${v}`).join('\n');
          }
          if (server.headers && typeof server.headers === 'object') {
            // Authorization / 任意头里的 Bearer token 提取到 token 字段（宽松，不强制）
            const auth = server.headers.Authorization ?? server.headers.authorization;
            if (typeof auth === 'string' && /^Bearer\s+/i.test(auth) && !next.token) {
              next.token = auth.replace(/^Bearer\s+/i, '');
            }
            next.headers = Object.fromEntries(Object.entries(server.headers).map(([k, v]) => [String(k), String(v).replace(/^Bearer\s+/i, (m) => m)]));
          }
          if (typeof server.token === 'string') next.token = server.token;
          setDraft(next);
          setJsonMsg('✓ ' + (name || 'server'));
        } catch (e) {
          setJsonMsg('✕ ' + String(e?.message ?? e));
        }
      };

      const authUi = def.renderAuth
        ? def.renderAuth({
            h, Field, inputCls, t, api, draft, set, setDraft, initial,
            onSaved, doSave, busy: authBusy, setBusy: setAuthBusy, setAuthMsg,
          })
        : null;

      return h('form', { className: 'mcx-editor mcx-editor-wide', onSubmit: submit },
        h('div', { className: 'mcx-editor-head' },
          h('span', null, h('span', { className: 'mcx-editor-icon' }, def.icon), ' ', isNew ? t(def.labelKey) : t('edit') + ' · ' + (draft.title || initial?.title || t(def.labelKey))),
          h('button', { type: 'button', className: 'mcx-iconbtn', onClick: onClose, 'aria-label': 'close' }, '✕')),
        // 连接器说明（“全部”目录点进来先看到这是什么）
        h('div', { className: 'mcx-def-desc' }, t(def.descKey)),
        isPreset ? h(Field, { label: t('fieldType') }, h('input', { className: inputCls, value: t(def.labelKey), disabled: true, readOnly: true })) : null,
        h(Field, { label: t('fieldTitle') }, h('input', { className: inputCls, value: draft.title ?? '', onChange: set('title'), placeholder: def.template.title || 'My Connector' })),
        h(Field, { label: t('fieldServerName') },
          isPreset
            ? h('input', { className: inputCls, value: def.template.serverName, disabled: true, readOnly: true })
            : h('input', { className: inputCls, value: draft.serverName ?? '', onChange: set('serverName'), placeholder: 'my-server（决定工具前缀 mcp__<标识>__*）' })),
        isCustom ? h(Field, { label: t('fieldTransport') },
          h('select', { className: inputCls, value: draft.transport, onChange: set('transport') },
            h('option', { value: 'streamable-http' }, 'streamable-http'),
            h('option', { value: 'stdio' }, 'stdio'),
            h('option', { value: 'wecom' }, 'wecom（企业微信）'))) : null,
        isCustom && draft.transport === 'stdio'
          ? h(React.Fragment, null,
              h(Field, { label: t('fieldCommand') }, h('input', { className: inputCls, value: draft.command ?? '', onChange: set('command'), placeholder: 'npx' })),
              h(Field, { label: t('fieldArgs') }, h('textarea', { className: inputCls, rows: 2, value: draft.argsText ?? '', onChange: set('argsText'), placeholder: '-y\n@modelcontextprotocol/server-xxx' })),
              h(Field, { label: t('fieldEnv') }, h('textarea', { className: inputCls, rows: 2, value: draft.envText ?? '', onChange: set('envText'), placeholder: 'API_KEY=xxx' })))
          : isCustom && draft.transport === 'streamable-http'
          ? h(React.Fragment, null,
              h(Field, { label: t('fieldUrl') }, h('input', { className: inputCls, value: draft.url ?? '', onChange: set('url'), placeholder: 'https://example.com/mcp（宽松：不强校验格式）' })),
              h('div', null,
                h(Field, { label: t('fieldToken') }, h('input', { className: inputCls, type: 'password', value: draft.token === '●' ? '' : draft.token ?? '', onChange: set('token'), placeholder: initial?.token === '●' ? '已保存 · 留空保持不变' : 'token 或整条安装指令均可，可留空' })),
                h('a', {
                  className: 'mcx-token-link',
                  href: draft.helpUrl || HELP_URL_BY_ENDPOINT[draft.url] || 'https://modelcontextprotocol.io',
                  target: '_blank', rel: 'noreferrer',
                }, t('getTokenHint'))))
          : null,
        isCustom && draft.transport === 'wecom'
          ? h(React.Fragment, null,
              h(Field, { label: 'CorpID' }, h('input', { className: inputCls, value: draft.corpid ?? '', onChange: set('corpid'), placeholder: '企业 ID（ww…）' })),
              h(Field, { label: '应用 Secret' }, h('input', { className: inputCls, type: 'password', value: draft.secret === '●' ? '' : draft.secret ?? '', onChange: set('secret'), placeholder: initial?.secret === '●' ? '已保存 · 留空保持不变' : '' })),
              h(Field, { label: 'AgentId（可选）' }, h('input', { className: inputCls, value: draft.agentid ?? '', onChange: set('agentid'), placeholder: '应用数字 ID' })))
          : null,
        // 预设连接器：渲染它自己定义的表单区（token / 授权按钮 / 提示等）
        isPreset ? authUi : null,
        h(Field, { label: t('fieldNote') }, h('textarea', { className: inputCls, rows: 2, value: draft.note ?? '', onChange: set('note') })),
        isCustom && isNew ? h('div', { className: 'mcx-json-paste' },
          h('div', { className: 'mcx-field-label' }, '📋 ', t('jsonPasteTitle')),
          h('textarea', { className: inputCls, rows: 5, value: jsonText, onChange: (e) => setJsonText(e.target.value), placeholder: t('jsonPastePlaceholder') }),
          h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' } },
            h('button', { type: 'button', className: 'mcx-btn', onClick: applyJson }, t('jsonParseBtn')),
            jsonMsg && h('span', { className: 'mcx-test-result ' + (jsonMsg.startsWith('✓') ? 'mcx-test-ok' : 'mcx-test-fail'), style: { padding: '2px 8px' } }, jsonMsg))) : null,
        err && h('div', { className: 'mcx-error' }, err),
        h('div', { className: 'mcx-editor-actions' },
          h('button', {
            type: 'button', className: 'mcx-btn', disabled: testing,
            onClick: async () => {
              setTesting(true); setTestResult('');
              try {
                const r = await onTest(draft);
                setTestResult(r);
              } catch (e2) { setTestResult('✕ ' + String(e2?.message ?? e2)); }
              finally { setTesting(false); }
            },
          }, testing ? t('testing') + '…' : t('testConn'))),
        testResult && h('div', { className: 'mcx-test-result' + (testResult.startsWith('✓') ? ' mcx-test-ok' : ' mcx-test-fail') }, testResult),
        authMsg && h('div', { className: 'mcx-test-result ' + (authMsg.startsWith('✓') ? 'mcx-test-ok' : 'mcx-auth-msg') }, authMsg),
        h('div', { className: 'mcx-editor-actions' },
          h('button', { type: 'submit', className: 'mcx-btn mcx-btn-primary', disabled: busy }, t('save')),
          h('button', { type: 'button', className: 'mcx-btn', onClick: onClose }, t('cancel')),
          !isNew && h('button', {
            type: 'button', className: 'mcx-btn mcx-btn-danger',
            onClick: async () => { if (!window.confirm(t('confirmDelete'))) return; setBusy(true); try { await onDelete?.(); onClose(); } catch (e2) { setErr(String(e2?.message ?? e2)); } finally { setBusy(false); } },
          }, t('del'))),
        h('p', { className: 'mcx-hint' }, t('hint')));
    }

    /* ================= 面板页：顶部 Tab（全部 / 已安装） ================= */

    function ConnectorsPage({ api, t }) {
      const [data, setData] = useState(null);
      const [err, setErr] = useState('');
      const [tab, setTab] = useState('all'); // 'all' | 'installed'
      const [editing, setEditing] = useState(null); // null | {} (新建) | connector

      const refresh = useCallback(async () => {
        if (!api) { setErr('Host 服务未就绪（mcpConnectors）'); return; }
        try { const r = await api.list(); if (r.ok) { setData(r.value); setErr(''); } else setErr(r.error?.message ?? 'error'); }
        catch (e) { setErr(String(e?.message ?? e)); }
      }, [api]);
      useEffect(() => { refresh(); }, [refresh]);

      const save = async (connector) => { const r = await api.save({ connector }); if (!r.ok) throw new Error(r.error?.message ?? 'save failed'); await refresh(); };
      const remove = async (id) => { const r = await api.remove({ id }); if (!r.ok) throw new Error(r.error?.message ?? 'remove failed'); await refresh(); };
      const toggle = async (c, enabled) => { const r = await api.setEnabled({ id: c.id, enabled }); if (!r.ok) throw new Error(r.error?.message ?? 'toggle failed'); await refresh(); };

      const installed = data?.connectors ?? [];
      /** 目录 = 全部连接器定义；已安装的显示角标 */
      const installedType = (defId) => installed.filter((c) => inferType(c) === defId).length;

      return h('div', { className: 'mcx-page' },
        h(Style, null),
        h('div', { className: 'mcx-page-head' },
          h('div', null,
            h('h2', { className: 'mcx-page-title' }, t('panelTitle')),
            h('p', { className: 'mcx-page-desc' }, t('panelDesc')))),
        h('div', { className: 'mcx-tabs', role: 'tablist' },
          h('button', {
            type: 'button', role: 'tab', 'aria-selected': String(tab === 'all'),
            className: 'mcx-tab' + (tab === 'all' ? ' mcx-tab-active' : ''),
            onClick: () => setTab('all'),
          }, t('tabAll')),
          h('button', {
            type: 'button', role: 'tab', 'aria-selected': String(tab === 'installed'),
            className: 'mcx-tab' + (tab === 'installed' ? ' mcx-tab-active' : ''),
            onClick: () => setTab('installed'),
          }, t('tabInstalled'), h('span', { className: 'mcx-tab-count' }, String(installed.length)))),
        err && h('div', { className: 'mcx-error' }, err, ' ', h('button', { className: 'mcx-btn', onClick: refresh }, t('retry'))),
        !data && !err && h('div', { className: 'mcx-empty' }, '…'),

        /* ---- Tab 1：全部（目录卡片，点开查看 + 创建） ---- */
        data && tab === 'all' && h('div', { className: 'mcx-grid' },
          CONNECTOR_DEFS.map((def) => h(CatalogCard, {
            key: def.id, def, t, installedCount: installedType(def.id),
            onOpen: () => setEditing({ type: def.id === 'custom' ? undefined : def.id, ...(def.template ?? {}) }),
          }))),

        /* ---- Tab 2：已安装（管理已创建的连接器） ---- */
        data && tab === 'installed' && (
          installed.length === 0
            ? h('div', { className: 'mcx-empty' }, t('emptyInstalled'), ' ',
                h('button', { type: 'button', className: 'mcx-btn', style: { marginLeft: '8px' }, onClick: () => setTab('all') }, t('goAllTab')))
            : h('div', { className: 'mcx-grid' },
                installed.map((c) => h(Card, {
                  key: c.id, c, mounted: (data.mounted ?? []).includes(c.serverName), t,
                  onToggle: (en) => toggle(c, en).catch((e) => setErr(String(e?.message ?? e))),
                  onEdit: () => setEditing(c),
                })))),

        editing && h('div', { className: 'mcx-modal-mask', onClick: (e) => { if (e.target === e.currentTarget) setEditing(null); } },
          h(ConnectorEditor, {
            initial: editing, t, api, onSave: save, onClose: () => setEditing(null),
            onDelete: () => remove(editing.id),
            onSaved: refresh,
            onTest: async (draft) => {
              const r = await api.test({ connector: { ...draft, id: editing?.id, serverName: draft.serverName } });
              if (!r.ok) return '✕ ' + (r.error?.message ?? 'test failed');
              return r.value.ok ? '✓ ' + r.value.message + (r.value.tools?.length ? '：' + r.value.tools.join(', ') : '')
                                 : '✕ ' + r.value.message;
            },
          })));
    }

    /** 「全部」目录卡片：图标 + 名称 + 说明 + 已安装角标；点击打开编辑器（查看 + 创建）。 */
    function CatalogCard({ def, t, installedCount, onOpen }) {
      return h('button', { type: 'button', className: 'mcx-card mcx-catalog-card', onClick: onOpen },
        h('div', { className: 'mcx-catalog-head' },
          h('span', { className: 'mcx-catalog-icon' }, def.icon),
          h('span', { className: 'mcx-card-title' }, t(def.labelKey)),
          installedCount > 0 ? h('span', { className: 'mcx-installed-badge' }, `✓ ${t('installedBadge')} ×${installedCount}`) : null),
        h('div', { className: 'mcx-catalog-desc' }, t(def.descKey)),
        h('div', { className: 'mcx-card-status' },
          h('span', { className: 'mcx-catalog-cta' }, t('viewAndCreate') + ' →')));
    }

    /** 「已安装」tab 的连接器卡片。 */
    function Card({ c, mounted, t, onToggle, onEdit }) {
      const on = c.enabled !== false;
      const ctype = inferType(c);
      const def = ctype ? DEF_BY_ID[ctype] : undefined;
      const typeLabel = def && def.id !== 'custom' ? t(def.labelKey) : null;
      return h('div', { className: 'mcx-card' + (on ? '' : ' mcx-card-off') },
        h('div', { className: 'mcx-card-corner' },
          h('button', { type: 'button', className: 'mcx-iconbtn', title: t('edit'), onClick: onEdit, 'aria-label': t('edit') }, '✎'),
          h(Switch, { checked: on, onChange: onToggle, title: on ? t('enabled') : t('disabled') })),
        h('div', { className: 'mcx-card-title' }, (def ? def.icon + ' ' : ''), c.title || c.serverName),
        h('div', { className: 'mcx-card-sub' }, (typeLabel ? typeLabel + ' · ' : '') + `mcp__${c.serverName}__*`),
        h('div', { className: 'mcx-card-url' }, c.transport === 'stdio' ? `${c.command} ${(c.args ?? []).join(' ')}` : c.url),
        c.note ? h('div', { className: 'mcx-card-note' }, c.note) : null,
        h('div', { className: 'mcx-card-status' },
          h('span', { className: 'mcx-dot ' + (!on ? 'mcx-dot-off' : mounted ? 'mcx-dot-on' : 'mcx-dot-warn') }),
          !on ? t('disabled') : mounted ? t('mounted') : t('notMounted')));
    }

    /* ================= 会话内选择下拉 ================= */

    function ComposerPicker({ api, sessionId, t }) {
      const [open, setOpen] = useState(false);
      const [data, setData] = useState(null);
      const wrapRef = useRef(null);
      const close = useCallback((e) => {
        if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
      }, []);
      useEffect(() => {
        window.addEventListener('mousedown', close);
        return () => window.removeEventListener('mousedown', close);
      }, [close]);
      const load = useCallback(async () => {
        if (!api) return;
        try { const r = await api.list(); if (r.ok) setData(r.value); } catch { /* 静默 */ }
      }, [api]);
      useEffect(() => { load(); }, [load]);
      useEffect(() => {
        const timer = setInterval(load, 30000);
        return () => clearInterval(timer);
      }, [load]);
      useEffect(() => { if (open) load(); }, [open, load]);

      const enabledConnectors = useMemo(
        () => (data?.connectors ?? []).filter((c) => c.enabled !== false), [data]);
      const chosen = useMemo(() => {
        if (!data || !sessionId) return null;
        // fail-closed：未记录的会话默认不勾选任何连接器
        return new Set(data.sessions?.[sessionId] ?? []);
      }, [data, sessionId]);
      const count = chosen ? `${chosen.size}/${enabledConnectors.length}` : '–';

      const toggleServer = async (sn) => {
        if (!chosen || !sessionId || !api) return;
        const next = new Set(chosen);
        if (next.has(sn)) next.delete(sn); else next.add(sn);
        const r = await api.setSession({ sessionId, enabled: [...next] });
        if (r.ok) applySession(next);
      };
      /** 与后端 POST /session 落盘规则镜像：直接保存勾选列表（全选=完整数组，全取消=空数组） */
      const applySession = (nextSet) => {
        setData((d) => ({
          ...d,
          sessions: { ...(d?.sessions ?? {}), [sessionId]: [...nextSet] },
        }));
      };
      const allOn = Boolean(chosen) && enabledConnectors.length > 0
        && enabledConnectors.every((c) => chosen.has(c.serverName));
      const toggleAll = async () => {
        if (!sessionId || !api || !chosen) return;
        const next = allOn ? new Set() : new Set(enabledConnectors.map((c) => c.serverName));
        const r = await api.setSession({ sessionId, enabled: [...next] });
        if (r.ok) applySession(next);
      };

      return h('div', { className: 'mcx-composer', ref: wrapRef },
        h(Style, null),
        h('button', {
          type: 'button', className: 'mcx-composer-btn' + (open ? ' mcx-composer-btn-active' : ''),
          onClick: () => setOpen((o) => !o), title: t('composerOpen'),
        }, h(LinkIcon, { size: 12 }), h('span', null, t('composerOpen')),
          h('span', { className: 'mcx-composer-count' }, count)),
        open && h('div', { className: 'mcx-popover' },
          enabledConnectors.length === 0
            ? h('div', { className: 'mcx-popover-empty' }, t('empty'))
            : h(React.Fragment, null,
                h('div', { className: 'mcx-popover-head' },
                  h('span', null, t('composerOpen')),
                  h('button', { type: 'button', className: 'mcx-chipbtn', onClick: toggleAll }, t(allOn ? 'deselectAll' : 'selectAll'))),
                enabledConnectors.map((c) => h('label', { key: c.id, className: 'mcx-popover-row' },
                  h('input', {
                    type: 'checkbox',
                    checked: chosen?.has(c.serverName) ?? false,
                    onChange: () => toggleServer(c.serverName),
                  }),
                  h('span', { className: 'mcx-popover-name' }, c.title || c.serverName),
                  h('span', { className: 'mcx-popover-sub' }, c.transport))))));
    }

    /* ================= 样式（仅主题 token） ================= */

    const STYLE_TEXT = `
.mcx-page{display:flex;flex-direction:column;gap:12px;height:100%;overflow:auto;padding:20px 24px;color:var(--dsw-alias-label-primary)}
.mcx-page-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
.mcx-page-title{margin:0;font-size:18px;font-weight:600}
.mcx-page-desc{margin:4px 0 0;font-size:12px;color:var(--dsw-alias-label-secondary)}
.mcx-tabs{display:flex;gap:4px;border-bottom:1px solid var(--dsw-alias-border-l1);padding:0 2px}
.mcx-tab{border:none;background:transparent;color:var(--dsw-alias-label-secondary);font-size:13px;padding:8px 14px;cursor:pointer;border-bottom:2px solid transparent;border-radius:6px 6px 0 0;display:inline-flex;align-items:center;gap:6px}
.mcx-tab:hover{color:var(--dsw-alias-label-primary)}
.mcx-tab-active{color:var(--dsw-alias-brand-primary);border-bottom-color:var(--dsw-alias-brand-primary);font-weight:600}
.mcx-tab-count{font-size:10px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;background:var(--dsw-alias-bg-layer-2);border-radius:999px;padding:1px 7px}
.mcx-tab-active .mcx-tab-count{color:var(--dsw-alias-brand-primary)}
.mcx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
.mcx-card{position:relative;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:14px 16px;min-height:140px;display:flex;flex-direction:column;gap:6px;transition:box-shadow .15s,border-color .15s;text-align:left}
.mcx-card:hover{border-color:var(--dsw-alias-border-l2);box-shadow:0 2px 10px rgba(0,0,0,.08)}
.mcx-card-off{opacity:.55}
.mcx-catalog-card{cursor:pointer;color:var(--dsw-alias-label-primary);font:inherit}
.mcx-catalog-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.mcx-catalog-icon{font-size:20px;line-height:1}
.mcx-catalog-desc{font-size:12px;color:var(--dsw-alias-label-secondary);line-height:1.5;white-space:pre-wrap}
.mcx-installed-badge{font-size:10px;color:var(--dsw-alias-state-success-primary);border:1px solid var(--dsw-alias-state-success-primary);border-radius:999px;padding:1px 8px;margin-left:auto}
.mcx-catalog-cta{color:var(--dsw-alias-brand-primary);font-weight:600}
.mcx-card-corner{position:absolute;top:10px;right:10px;display:flex;align-items:center;gap:6px;opacity:0;transition:opacity .12s;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:3px 6px;box-shadow:0 1px 6px rgba(0,0,0,.18)}
.mcx-card:hover .mcx-card-corner,.mcx-card-corner:focus-within{opacity:1}
.mcx-card-title{font-weight:600;font-size:14px;padding-right:70px}
.mcx-card-sub{font-size:11px;color:var(--dsw-alias-label-tertiary);font-family:monospace}
.mcx-card-url{font-size:12px;color:var(--dsw-alias-label-secondary);word-break:break-all}
.mcx-card-note{font-size:12px;color:var(--dsw-alias-label-secondary);border-top:1px dashed var(--dsw-alias-border-l1);padding-top:6px;white-space:pre-wrap}
.mcx-card-status{margin-top:auto;display:flex;align-items:center;gap:6px;font-size:11px;color:var(--dsw-alias-label-tertiary)}
.mcx-dot{width:8px;height:8px;border-radius:50%;display:inline-block}
.mcx-dot-on{background:var(--dsw-alias-state-success-primary)}
.mcx-dot-warn{background:var(--dsw-alias-state-warn-primary)}
.mcx-dot-off{background:var(--dsw-alias-state-idle-primary)}
.mcx-switch{width:32px;height:18px;border-radius:9px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);position:relative;cursor:pointer;padding:0;box-shadow:inset 0 0 0 1px rgba(0,0,0,.08)}
.mcx-switch-knob{position:absolute;top:1px;left:1px;width:14px;height:14px;border-radius:50%;background:var(--dsw-alias-label-secondary);box-shadow:0 1px 2px rgba(0,0,0,.35);transition:left .15s,background .15s}
.mcx-switch-on{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}
.mcx-switch-on .mcx-switch-knob{left:15px;background:#fff}
.mcx-iconbtn{border:none;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);border-radius:6px;width:24px;height:24px;cursor:pointer;font-size:12px;line-height:1}
.mcx-iconbtn:hover{color:var(--dsw-alias-label-primary)}
.mcx-btn{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer}
.mcx-btn-primary{background:transparent;border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}
.mcx-btn-primary:hover{background:var(--dsw-alias-bg-layer-2)}
.mcx-btn-danger{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary);margin-right:auto}
.mcx-btn:disabled{opacity:.5;cursor:default}
.mcx-empty{color:var(--dsw-alias-label-tertiary);font-size:13px;padding:24px;text-align:center}
.mcx-error{color:var(--dsw-alias-state-error-primary);font-size:12px}
.mcx-modal-mask{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:1000}
.mcx-editor{background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l1);border-radius:14px;padding:18px;width:min(440px,92vw);max-height:86vh;overflow:auto;display:flex;flex-direction:column;gap:10px;color:var(--dsw-alias-label-primary)}
.mcx-editor-wide{width:min(520px,94vw)}
.mcx-editor-head{display:flex;justify-content:space-between;align-items:center;font-weight:600}
.mcx-editor-icon{font-size:16px}
.mcx-def-desc{font-size:12px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);border-radius:8px;padding:8px 10px;line-height:1.5}
.mcx-chipbtn{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);border-radius:999px;padding:3px 10px;font-size:11px;cursor:pointer}
.mcx-chipbtn:hover{color:var(--dsw-alias-label-primary)}
.mcx-field{display:flex;flex-direction:column;gap:4px;font-size:12px}
.mcx-field-label{color:var(--dsw-alias-label-secondary)}
.mcx-input{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 10px;font-size:12px;width:100%;box-sizing:border-box}
.mcx-editor-actions{display:flex;gap:8px;justify-content:flex-end}
.mcx-token-link{font-size:11px;color:var(--dsw-alias-brand-primary);text-decoration:none;width:fit-content}
.mcx-token-link:hover{text-decoration:underline}
.mcx-test-result{font-size:12px;border-radius:8px;padding:8px 10px;word-break:break-all}
.mcx-test-ok{color:var(--dsw-alias-state-success-primary);background:var(--dsw-alias-bg-layer-2)}
.mcx-test-fail{color:var(--dsw-alias-state-error-primary);background:var(--dsw-alias-bg-layer-2)}
.mcx-auth-btn{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}
.mcx-auth-msg{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2)}
.mcx-auth-hint{font-size:11px;color:var(--dsw-alias-label-tertiary)}
.mcx-hint{margin:0;font-size:11px;color:var(--dsw-alias-label-tertiary)}
.mcx-json-paste{display:flex;flex-direction:column;gap:4px;border:1px dashed var(--dsw-alias-border-l2);border-radius:10px;padding:10px}
.mcx-json-paste textarea{font-family:monospace;font-size:11px}
.mcx-composer{position:relative;display:inline-flex}
.mcx-composer-btn{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);border-radius:999px;padding:2px 10px;font-size:11px;cursor:pointer;height:24px}
.mcx-composer-btn:hover,.mcx-composer-btn-active{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-brand-primary)}
.mcx-composer-count{font-size:10px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
.mcx-popover{position:absolute;bottom:calc(100% + 8px);left:0;min-width:240px;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.18);padding:10px;display:flex;flex-direction:column;gap:6px;z-index:1200;color:var(--dsw-alias-label-primary)}
.mcx-popover-head{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--dsw-alias-label-secondary)}
.mcx-popover-row{display:flex;align-items:center;gap:8px;font-size:12px;padding:4px 6px;border-radius:6px;cursor:pointer}
.mcx-popover-row:hover{background:var(--dsw-alias-bg-layer-2)}
.mcx-popover-name{flex:1}
.mcx-popover-sub{font-size:10px;color:var(--dsw-alias-label-tertiary)}
.mcx-popover-empty{font-size:11px;color:var(--dsw-alias-label-tertiary);padding:6px}
`.trim();

    function Style() {
      return h('style', { key: 'mcx-style' }, STYLE_TEXT);
    }

    /* ================= 图标 ================= */

    /** 链条（link）图标：两个环 + 中段连接，18/12px 都清晰。 */
    function LinkIcon({ size = 14 }) {
      return h('svg', {
        viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': true,
        style: { display: 'block', flex: 'none' },
      },
        h('path', {
          d: 'M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L11 4.93',
          fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round',
        }),
        h('path', {
          d: 'M14 11a5 5 0 0 0-7.07 0L4.81 13.12a5 5 0 0 0 7.07 7.07L13 19.07',
          fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round',
        }));
    }

    function PanelIcon({ size = 18, active = false }) {
      const stroke = active ? 'var(--dsw-alias-brand-primary)' : 'currentColor';
      return h('svg', { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': true },
        h('path', {
          d: 'M9 3v5M15 3v5M7 8h10v3a5 5 0 0 1-5 5 5 5 0 0 1-5-5V8zM12 16v5',
          fill: 'none', stroke, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
        }));
    }

    /* ================= Host HTTP API ================= */

    async function call(method, path, body) {
      const res = await fetch(`/mcp-connectors${path}`, {
        method,
        cache: 'no-store',
        headers: body === undefined ? undefined : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      let payload = null;
      try { payload = await res.json(); } catch { /* ignore */ }
      if (!res.ok || !payload || payload.ok !== true) {
        return { ok: false, error: { message: payload?.error?.message ?? `HTTP ${res.status}` } };
      }
      return { ok: true, value: payload.value };
    }

    const HTTP_API = {
      list: () => call('GET', '/state'),
      save: (body) => call('POST', '/save', body),
      remove: (body) => call('POST', '/remove', body),
      setEnabled: (body) => call('POST', '/enabled', body),
      setSession: (body) => call('POST', '/session', body),
      test: (body) => call('POST', '/test', body),
      authStart: (body) => call('POST', '/auth/start', body),
      authStatus: (body) => call('POST', '/auth/status', body),
      wxAuthStart: (body) => call('POST', '/wx-auth/start', body),
      wxAuthStatus: (body) => call('POST', '/wx-auth/status', body),
      wxAuthCancel: (body) => call('POST', '/wx-auth/cancel', body),
      listSessions: () => call('GET', '/sessions'),
    };

    /* ================= 插件装配 ================= */

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, DICTS), NS);
        const t = (key) => {
          const snap = ctx.locale?.getLocale?.() ?? { id: 'zh' };
          const dict = DICTS[snap.id] ?? DICTS.zh;
          return dict[key] ?? key;
        };
        const api = HTTP_API;

        // 侧边栏图标（点击 → layout.selectPanel(PANEL_ID) → main 面板）
        ctx.effect(() => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register(
          { name: 'sidebar.panellist', id: PANEL_ID, order: 40, locale: NS, label: () => t('panelTitle') },
          PanelIcon,
        )), NS + ': panel icon');

        // 中央面板页
        ctx.effect(() => ctx.slots.inject('main', () => ctx.slots.register(
          { name: 'main', key: PANEL_ID, locale: NS },
          () => h(ConnectorsPage, { api, t }),
        )), NS + ': panel page');

        // 会话 composer 左下角连接器选择
        ctx.effect(() => ctx.slots.inject('conversation.input.left', () => ctx.slots.register(
          {
            name: 'conversation.input.left', id: 'mcp-connectors-picker', order: 5, locale: NS,
            inject: (arg) => ({ sessionId: typeof arg === 'string' ? arg : arg?.sessionId ?? arg?.session?.id }),
          },
          (props) => h(ComposerPicker, { api, sessionId: props?.sessionId, t }),
        )), NS + ': composer picker');
      },
    };
  },
});
