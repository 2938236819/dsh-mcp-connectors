/**
 * @wfm-cn/dsh-mcp-connectors — MCP 连接器中心（Client 侧）
 *
 *  - sidebar.panellist 图标 + `main` 面板页（卡片流，hover 出现编辑/开关）；
 *  - conversation.input.left 会话内连接器选择下拉（向上弹出，按会话生效）；
 *  - 所有 Host 交互走 ctx.remote['mcp-connectors'].*。
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
        add: '添加连接器',
        empty: '还没有连接器。点击「添加连接器」开始，例如腾讯文档官方 MCP。',
        enabled: '已启用',
        disabled: '已停用',
        mounted: '已连接',
        notMounted: '未连接',
        edit: '编辑',
        del: '删除',
        confirmDelete: '确定删除该连接器？',
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
        composerOpen: '连接器',
        composerNone: '当前会话未启用任何连接器',
        composerAll: '全部',
        loadFailed: '加载失败',
        retry: '重试',
        hint: '工具将以 mcp__<标识>__<工具名> 出现在会话中。',
      },
      en: {
        panelTitle: 'Connectors',
        panelDesc: 'Manage MCP connectors: add, authorize, toggle, and pick per conversation.',
        add: 'Add connector',
        empty: 'No connectors yet. Click "Add connector" — e.g. Tencent Docs official MCP.',
        enabled: 'Enabled',
        disabled: 'Disabled',
        mounted: 'Connected',
        notMounted: 'Not connected',
        edit: 'Edit',
        del: 'Delete',
        confirmDelete: 'Delete this connector?',
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
        composerOpen: 'Connectors',
        composerNone: 'No connector enabled in this conversation',
        composerAll: 'All',
        loadFailed: 'Failed to load',
        retry: 'Retry',
        hint: 'Tools appear as mcp__<server>__<tool> in conversations.',
      },
    };

    /* ---------------- 小部件 ---------------- */

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

    /* ---------------- 卡片编辑器 ---------------- */

    /** 预设清单：新增连接器时从下拉里选。加新预设只改这里。
     *  helpUrl 是该服务的 token 获取页（各服务不同，绝不混用）。 */
    const PRESETS = [
      {
        id: 'tencent-docs',
        labelKey: 'presetTencentDocs',
        template: {
          title: '腾讯文档', serverName: 'tencent-docs', transport: 'streamable-http',
          url: 'https://docs.qq.com/openapi/mcp',
          helpUrl: 'https://docs.qq.com/scenario/open-claw.html',
        },
      },
      {
        id: 'kdocs',
        labelKey: 'presetKdocs',
        template: {
          title: '金山文档', serverName: 'kdocs-wps', transport: 'streamable-http',
          url: 'https://mcp-center.wps.cn/skill_hub/mcp',
          auth: 'wps',
        },
      },
      {
        id: 'github',
        labelKey: 'presetGithub',
        template: {
          title: 'GitHub', serverName: 'github', transport: 'streamable-http',
          url: 'https://api.githubcopilot.com/mcp/',
          helpUrl: 'https://github.com/settings/personal-access-tokens',
        },
      },
      {
        id: 'wechat',
        labelKey: 'presetWechat',
        template: {
          title: '微信 (ClawBot)', serverName: 'weixin-mcp', transport: 'stdio',
          command: 'npx', args: ['-y', 'weixin-mcp'],
          auth: 'wxqr',
        },
      },
      {
        id: 'chrome',
        labelKey: 'presetChrome',
        template: {
          title: '谷歌浏览器', serverName: 'chrome-devtools', transport: 'stdio',
          command: 'npx', args: ['-y', 'chrome-devtools-mcp@latest'],
        },
      },
      {
        id: 'custom',
        labelKey: 'presetCustom',
        template: { title: '', serverName: '', transport: 'streamable-http', url: '' },
      },
    ];
    /** 按端点 URL 匹配已知预设的 token 帮助页（编辑旧连接器也显示正确链接）。 */
    const HELP_URL_BY_ENDPOINT = {
      'https://docs.qq.com/openapi/mcp': 'https://docs.qq.com/scenario/open-claw.html',
            'https://api.githubcopilot.com/mcp/': 'https://github.com/settings/personal-access-tokens',
    };
    /** 由 serverName/url 推断连接器类型（兼容存量数据）；返回 undefined 表示自定义。 */
    function inferType(c) {
      if (!c) return undefined;
      if (c.type) return c.type;
      const sn = String(c.serverName ?? '');
      const url = String(c.url ?? '');
      if (sn === 'chrome-devtools' || /chrome-devtools-mcp/.test(`${c.command ?? ''} ${(c.args ?? []).join(' ')}`)) return 'chrome';
      if (c.auth === 'wxqr' || sn === 'weixin-mcp') return 'wechat';
      if (c.auth === 'wps' || sn === 'kdocs-wps' || /mcp-center\.wps\.cn/.test(url)) return 'kdocs';
      if (c.auth === 'pat' || sn === 'github' || /api\.githubcopilot\.com/.test(url)) return 'github';
      if (sn === 'tencent-docs' || /docs\.qq\.com\/openapi\/mcp/.test(url)) return 'tencent-docs';
      return undefined;
    }
    const PRESET_BY_ID = Object.fromEntries(PRESETS.map((p) => [p.id, p]));

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
    function WechatQrAuth({ t, api, onSaved, onSave, busy, setBusy, msg, setMsg, isNew, initialServerName }) {      const [qr, setQr] = useState('');       // 二维码 PNG data URL
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
            if (v.status === 'refreshed' && v.image) { setQr(v.image); setPhase('waiting'); setMsg(''); }
            else if (v.status === 'waiting' && v.image && !qr) setQr(v.image);
            else if (v.status === 'scaned') { setPhase('scaned'); setMsg(t('wxScaned')); }
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

    function ConnectorEditor({ initial, t, api, onSave, onDelete, onTest, onSaved, onClose }) {
      const [draft, setDraft] = useState(() => ({
        title: '', serverName: '', transport: 'streamable-http', url: '', token: '',
        command: '', argsText: '', envText: '', note: '', enabled: true,
        ...(initial && initial.env ? { envText: Object.entries(initial.env).map(([k, v]) => `${k}=${v}`).join('\n') } : {}),
        ...(initial ?? {}),
      }));
      const [busy, setBusy] = useState(false);
      const [err, setErr] = useState('');
      const [testing, setTesting] = useState(false);
      const [testResult, setTestResult] = useState('');
      const [authBusy, setAuthBusy] = useState(false);
      const [authMsg, setAuthMsg] = useState('');
      const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));
      const isNew = !initial?.id;
      // 类型：预设固定不可改；自定义没有类型字段
      const ctype = inferType({ ...draft, ...initial }); // '' / undefined => custom
      const isPreset = Boolean(ctype && PRESET_BY_ID[ctype]);
      const presetDef = isPreset ? PRESET_BY_ID[ctype] : null;
      const isCustom = !isPreset;

      const doSave = async (closeAfter = true) => {
        setBusy(true); setErr('');
        try {
          const connector = {
            ...draft,
            id: initial?.id,
            type: isPreset ? ctype : undefined,
            title: draft.title, serverName: draft.serverName, transport: draft.transport,
            note: draft.note, enabled: draft.enabled !== false,
          };
          if (isPreset) {
            // 类型固定：地址/标识/transport 一律以预设为准，用户只能改名称、token、备注
            const tpl = presetDef.template;
            connector.serverName = tpl.serverName;
            connector.transport = tpl.transport;
            if (tpl.url) connector.url = tpl.url;
            if (tpl.auth) connector.auth = tpl.auth;
            if (tpl.command) connector.command = tpl.command;
            if (tpl.args) connector.args = tpl.args;
          }
          if (draft.transport === 'stdio') {
            connector.command = draft.command || presetDef?.template?.command;
            connector.args = presetDef?.template?.args
              ?? String(draft.argsText ?? '').split('\n').map((x) => x.trim()).filter(Boolean);
            connector.env = Object.fromEntries(
              String(draft.envText ?? '').split('\n').map((l) => l.trim())
                .filter((l) => l && l.includes('='))
                .map((l) => { const eq = l.indexOf('='); return [l.slice(0, eq).trim(), l.slice(eq + 1).trim()]; }));
            delete connector.url; delete connector.token;
          } else {
            connector.url = draft.url; connector.token = draft.token;
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

      return h('form', { className: 'mcx-editor', onSubmit: submit },
        h('div', { className: 'mcx-editor-head' },
          h('span', null, isNew ? t('add') : t('edit')),
          h('button', { type: 'button', className: 'mcx-iconbtn', onClick: onClose, 'aria-label': 'close' }, '✕')),
        h(Field, { label: t('fieldTitle') }, h('input', { className: inputCls, value: draft.title ?? '', onChange: set('title'), placeholder: isPreset ? presetDef.template.title : 'Tencent Docs' })),
        isPreset ? h(Field, { label: t('fieldType') }, h('input', { className: inputCls, value: t(presetDef.labelKey), disabled: true, readOnly: true })) : null,
        h(Field, { label: t('fieldServerName') },
          isPreset
            ? h('input', { className: inputCls, value: presetDef.template.serverName, disabled: true, readOnly: true })
            : h('input', { className: inputCls, value: draft.serverName ?? '', onChange: set('serverName'), placeholder: 'tencent-docs', pattern: '[A-Za-z0-9_-]{1,32}', required: true })),
        isCustom ? h(Field, { label: t('fieldTransport') },
          h('select', { className: inputCls, value: draft.transport, onChange: set('transport') },
            h('option', { value: 'streamable-http' }, 'streamable-http'),
            h('option', { value: 'stdio' }, 'stdio'))) : null,
        isCustom && draft.transport === 'stdio'
          ? h(React.Fragment, null,
              h(Field, { label: t('fieldCommand') }, h('input', { className: inputCls, value: draft.command ?? '', onChange: set('command'), placeholder: 'npx', required: true })),
              h(Field, { label: t('fieldArgs') }, h('textarea', { className: inputCls, rows: 2, value: draft.argsText ?? '', onChange: set('argsText'), placeholder: '-y\n@modelcontextprotocol/server-xxx' })),
              h(Field, { label: t('fieldEnv') }, h('textarea', { className: inputCls, rows: 2, value: draft.envText ?? '', onChange: set('envText'), placeholder: 'API_KEY=xxx' })))
          : isCustom
          ? h(React.Fragment, null,
              h(Field, { label: t('fieldUrl') }, h('input', { className: inputCls, value: draft.url ?? '', onChange: set('url'), placeholder: 'https://docs.qq.com/openapi/mcp', required: true })),
              h('div', null,
                h(Field, { label: t('fieldToken') }, h('input', { className: inputCls, type: 'password', value: draft.token === '●' ? '' : draft.token ?? '', onChange: set('token'), placeholder: initial?.token === '●' ? '已保存 · 留空保持不变' : '粘贴 token 或整条安装指令均可' })),
                h('a', {
                  className: 'mcx-token-link',
                  href: draft.helpUrl || HELP_URL_BY_ENDPOINT[draft.url] || 'https://docs.qq.com/scenario/open-claw.html',
                  target: '_blank', rel: 'noreferrer',
                }, t('getTokenHint'))))
          : h(React.Fragment, null,
              // 预设类型：只显示该类型自己的字段
              ctype === 'chrome'
                ? h('div', { className: 'mcx-auth-hint' }, t('chromeHint'))
                : null,
              ctype === 'github'
                ? h(React.Fragment, null,
                    h(Field, { label: t('fieldToken') }, h('input', { className: inputCls, type: 'password', value: draft.token === '●' ? '' : draft.token ?? '', onChange: set('token'), placeholder: initial?.token === '●' ? '已保存 · 留空保持不变' : 'github_pat_…' })),
                    h('a', {
                      className: 'mcx-btn mcx-auth-btn mcx-token-link',
                      href: 'https://github.com/settings/personal-access-tokens',
                      target: '_blank', rel: 'noreferrer',
                    }, t('githubCreateBtn')))
                : null,
              ctype === 'wechat'
                ? h(React.Fragment, null,                    h(WechatSessionPicker, { t, api, value: draft.targetSession ?? '', onChange: (v) => setDraft((d) => ({ ...d, targetSession: v })) }),
                    h(WechatQrAuth, { t, api, onSaved, onSave: () => doSave(false), busy: authBusy, setBusy: setAuthBusy, msg: authMsg, setMsg: setAuthMsg, isNew, initialServerName: initial?.serverName }))
                : null,
              ctype === 'kdocs'
                ? h(React.Fragment, null,
                    h('button', {
                      type: 'button', className: 'mcx-btn mcx-auth-btn', disabled: authBusy,
                      onClick: async () => {
                        const sn = draft.serverName || initial?.serverName;
                        if (!sn) { setAuthMsg('✕ ' + t('authNeedName')); return; }
                        setAuthBusy(true); setAuthMsg(t('authOpening'));
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
                        finally { setAuthBusy(false); }
                      },
                    }, authBusy ? t('authWaiting') : t('authWps')),
                    h('div', { className: 'mcx-auth-hint' }, t('authHint')))
                : null,
              ctype === 'tencent-docs'
                ? h(React.Fragment, null,
                    h(Field, { label: t('fieldToken') }, h('input', { className: inputCls, type: 'password', value: draft.token === '●' ? '' : draft.token ?? '', onChange: set('token'), placeholder: initial?.token === '●' ? '已保存 · 留空保持不变' : '粘贴 token 或整条安装指令均可' })),
                    h('a', {
                      className: 'mcx-token-link',
                      href: 'https://docs.qq.com/scenario/open-claw.html',
                      target: '_blank', rel: 'noreferrer',
                    }, t('getTokenHint')))
                : null),
        h(Field, { label: t('fieldNote') }, h('textarea', { className: inputCls, rows: 2, value: draft.note ?? '', onChange: set('note') })),
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
        authMsg && h('div', { className: 'mcx-test-result ' + (authMsg.startsWith('✓') ? ' mcx-test-ok' : ' mcx-auth-msg') }, authMsg),
        h('div', { className: 'mcx-editor-actions' },
          h('button', { type: 'submit', className: 'mcx-btn mcx-btn-primary', disabled: busy }, t('save')),
          h('button', { type: 'button', className: 'mcx-btn', onClick: onClose }, t('cancel')),
          !isNew && h('button', {
            type: 'button', className: 'mcx-btn mcx-btn-danger',
            onClick: async () => { if (!window.confirm(t('confirmDelete'))) return; setBusy(true); try { await onDelete?.(); onClose(); } catch (e2) { setErr(String(e2?.message ?? e2)); } finally { setBusy(false); } },
          }, t('del'))),
        h('p', { className: 'mcx-hint' }, t('hint')));
    }

    /* ---------------- 面板页 ---------------- */

    function ConnectorsPage({ api, t }) {
      const [data, setData] = useState(null);
      const [err, setErr] = useState('');
      const [editing, setEditing] = useState(null); // null | {} (new) | connector
      const [addOpen, setAddOpen] = useState(false);
      const addRef = useRef(null);

      const refresh = useCallback(async () => {
        if (!api) { setErr('Host 服务未就绪（mcpConnectors）'); return; }
        try { const r = await api.list(); if (r.ok) { setData(r.value); setErr(''); } else setErr(r.error?.message ?? 'error'); }
        catch (e) { setErr(String(e?.message ?? e)); }
      }, [api]);
      useEffect(() => { refresh(); }, [refresh]);
      useEffect(() => {
        if (!addOpen) return undefined;
        const off = (e) => { if (!addRef.current?.contains(e.target)) setAddOpen(false); };
        window.addEventListener('mousedown', off);
        return () => window.removeEventListener('mousedown', off);
      }, [addOpen]);

      const save = async (connector) => { const r = await api.save({ connector }); if (!r.ok) throw new Error(r.error?.message ?? 'save failed'); await refresh(); };
      const remove = async (id) => { const r = await api.remove({ id }); if (!r.ok) throw new Error(r.error?.message ?? 'remove failed'); await refresh(); };
      const toggle = async (c, enabled) => { const r = await api.setEnabled({ id: c.id, enabled }); if (!r.ok) throw new Error(r.error?.message ?? 'toggle failed'); await refresh(); };

      return h('div', { className: 'mcx-page' },
        h(Style, null),
        h('div', { className: 'mcx-page-head' },
          h('div', null,
            h('h2', { className: 'mcx-page-title' }, t('panelTitle')),
            h('p', { className: 'mcx-page-desc' }, t('panelDesc'))),
          h('div', { className: 'mcx-add-wrap', ref: addRef },
            h('button', {
              type: 'button', className: 'mcx-btn mcx-btn-primary',
              onClick: () => setAddOpen((o) => !o), 'aria-haspopup': 'menu', 'aria-expanded': String(addOpen),
            }, '+ ', t('add'), ' ▾'),
            addOpen && h('div', { className: 'mcx-add-menu', role: 'menu' },
              h('div', { className: 'mcx-add-menu-title' }, t('addMenuTitle')),
              PRESETS.map((p) => h('button', {
                key: p.id, type: 'button', role: 'menuitem', className: 'mcx-add-menu-item',
                onClick: () => { setAddOpen(false); setEditing({ type: p.id === 'custom' ? undefined : p.id, ...(p.template ?? {}) }); },
              }, t(p.labelKey)))))),
        err && h('div', { className: 'mcx-error' }, err, ' ', h('button', { className: 'mcx-btn', onClick: refresh }, t('retry'))),
        !data && !err && h('div', { className: 'mcx-empty' }, '…'),
        data && data.connectors.length === 0 && h('div', { className: 'mcx-empty' }, t('empty')),
        data && data.connectors.length > 0 && h('div', { className: 'mcx-grid' },
          data.connectors.map((c) => h(Card, {
            key: c.id, c, mounted: (data.mounted ?? []).includes(c.serverName), t,
            onToggle: (en) => toggle(c, en).catch((e) => setErr(String(e?.message ?? e))),
            onEdit: () => setEditing(c),
          }))),
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

    function Card({ c, mounted, t, onToggle, onEdit }) {
      const on = c.enabled !== false;
      const ctype = inferType(c);
      const typeLabel = ctype && PRESET_BY_ID[ctype] ? t(PRESET_BY_ID[ctype].labelKey) : null;
      return h('div', { className: 'mcx-card' + (on ? '' : ' mcx-card-off') },
        h('div', { className: 'mcx-card-corner' },
          h('button', { type: 'button', className: 'mcx-iconbtn', title: t('edit'), onClick: onEdit, 'aria-label': t('edit') }, '✎'),
          h(Switch, { checked: on, onChange: onToggle, title: on ? t('enabled') : t('disabled') })),
        h('div', { className: 'mcx-card-title' }, c.title || c.serverName),
        h('div', { className: 'mcx-card-sub' }, (typeLabel ? typeLabel + ' · ' : '') + `mcp__${c.serverName}__*`),
        h('div', { className: 'mcx-card-url' }, c.transport === 'stdio' ? `${c.command} ${(c.args ?? []).join(' ')}` : c.url),
        c.note ? h('div', { className: 'mcx-card-note' }, c.note) : null,
        h('div', { className: 'mcx-card-status' },
          h('span', { className: 'mcx-dot ' + (!on ? 'mcx-dot-off' : mounted ? 'mcx-dot-on' : 'mcx-dot-warn') }),
          !on ? t('disabled') : mounted ? t('mounted') : t('notMounted')));
    }

    /* ---------------- 会话内选择下拉 ---------------- */

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
      // 进聊天框立即加载，之后每 30 秒静默刷新，展开时也刷新
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
        const pick = data.sessions?.[sessionId];
        return pick ? new Set(pick) : new Set(enabledConnectors.map((c) => c.serverName));
      }, [data, sessionId, enabledConnectors]);
      const count = chosen ? `${chosen.size}/${enabledConnectors.length}` : '–';

      const toggleServer = async (sn) => {
        if (!chosen || !sessionId || !api) return;
        const next = new Set(chosen);
        if (next.has(sn)) next.delete(sn); else next.add(sn);
        const r = await api.setSession({ sessionId, enabled: [...next] });
        if (r.ok) setData((d) => ({ ...d, sessions: { ...(d?.sessions ?? {}), [sessionId]: [...next] } }));
      };
      const selectAll = async () => {
        if (!api) return;
        const r = await api.setSession({ sessionId, enabled: enabledConnectors.map((c) => c.serverName) });
        if (r.ok) setData((d) => ({ ...d, sessions: { ...(d?.sessions ?? {}), [sessionId]: [] } }));
      };

      return h('div', { className: 'mcx-composer', ref: wrapRef },
        h(Style, null),
        h('button', {
          type: 'button', className: 'mcx-composer-btn' + (open ? ' mcx-composer-btn-active' : ''),
          onClick: () => setOpen((o) => !o), title: t('composerOpen'),
        }, h(LinkIcon, { size: 12 }), h('span', null, t('composerOpen')),
          data && enabledConnectors.length > 0 && h('span', { className: 'mcx-composer-dots', 'aria-hidden': true },
            enabledConnectors.map((c) => h('span', {
              key: c.id,
              className: 'mcx-mini-dot ' + ((data.mounted ?? []).includes(c.serverName) ? 'mcx-mini-dot-on' : 'mcx-mini-dot-warn'),
              title: (c.title || c.serverName) + ((data.mounted ?? []).includes(c.serverName) ? '' : ' · ' + t('notMounted')),
            }))),
          h('span', { className: 'mcx-composer-count' }, count)),
        open && h('div', { className: 'mcx-popover' },
          enabledConnectors.length === 0
            ? h('div', { className: 'mcx-popover-empty' }, t('empty'))
            : h(React.Fragment, null,
                h('div', { className: 'mcx-popover-head' },
                  h('span', null, t('composerOpen')),
                  h('button', { type: 'button', className: 'mcx-chipbtn', onClick: selectAll }, t('composerAll'))),
                enabledConnectors.map((c) => h('label', { key: c.id, className: 'mcx-popover-row' },
                  h('input', {
                    type: 'checkbox',
                    checked: chosen?.has(c.serverName) ?? false,
                    onChange: () => toggleServer(c.serverName),
                  }),
                  h('span', { className: 'mcx-popover-name' }, c.title || c.serverName),
                  h('span', { className: 'mcx-popover-sub' }, c.transport))),
                chosen && chosen.size === 0 && h('div', { className: 'mcx-popover-empty' }, t('composerNone')))));
    }

    /* ---------------- 样式（仅主题 token） ---------------- */

    const STYLE_TEXT = `
.mcx-page{display:flex;flex-direction:column;gap:12px;height:100%;overflow:auto;padding:20px 24px;color:var(--dsw-alias-label-primary)}
.mcx-page-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
.mcx-add-wrap{position:relative}
.mcx-add-menu{position:absolute;right:0;top:calc(100% + 6px);min-width:200px;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.16);padding:6px;z-index:1100;display:flex;flex-direction:column;gap:2px}
.mcx-add-menu-title{font-size:10px;color:var(--dsw-alias-label-tertiary);padding:4px 8px}
.mcx-add-menu-item{border:none;background:transparent;color:var(--dsw-alias-label-primary);text-align:left;font-size:12px;padding:7px 8px;border-radius:6px;cursor:pointer}
.mcx-add-menu-item:hover{background:var(--dsw-alias-bg-layer-2)}
.mcx-page-title{margin:0;font-size:18px;font-weight:600}
.mcx-page-desc{margin:4px 0 0;font-size:12px;color:var(--dsw-alias-label-secondary)}
.mcx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px}
.mcx-card{position:relative;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:14px 16px;min-height:140px;display:flex;flex-direction:column;gap:6px;transition:box-shadow .15s,border-color .15s}
.mcx-card:hover{border-color:var(--dsw-alias-border-l2);box-shadow:0 2px 10px rgba(0,0,0,.08)}
.mcx-card-off{opacity:.55}
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
.mcx-editor-head{display:flex;justify-content:space-between;align-items:center;font-weight:600}
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
.mcx-composer{position:relative;display:inline-flex}
.mcx-composer-btn{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);border-radius:999px;padding:2px 10px;font-size:11px;cursor:pointer;height:24px}
.mcx-composer-btn:hover,.mcx-composer-btn-active{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-brand-primary)}
.mcx-composer-count{font-size:10px;color:var(--dsw-alias-label-tertiary)}
.mcx-composer-dots{display:inline-flex;align-items:center;gap:3px;margin-left:2px}
.mcx-mini-dot{width:6px;height:6px;border-radius:50%;display:inline-block}
.mcx-mini-dot-on{background:var(--dsw-alias-state-success-primary)}
.mcx-mini-dot-warn{background:var(--dsw-alias-state-warn-primary)}
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

    /* ---------------- 图标 ---------------- */

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

    /* ---------------- Host HTTP API ---------------- */

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

    /* ---------------- 插件装配 ---------------- */

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
