import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import './App.css'
import { BrowserRouter as Router, Routes, Route, Link, NavLink, useLocation, useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useAccount, useConnect, useDisconnect, useSignMessage } from 'wagmi'
import { useQuery } from '@tanstack/react-query'

const LOGIN_ENDPOINT = 'https://api.lazpad.fun/lazai'
const LOGIN_QUERY = 'mutation login($req: LoginReq!) { login(req: $req) { data { userId token } } } '
const PROFILE_QUERY = 'query getUserDetail($id: String!) { getUserDetail(id: $id) { data { name } success traceId } } '
const GET_NONCE_QUERY = 'query getNonce($address: String!) { getNonce(address: $address) { data } } '
const API_BASE_URL = (import.meta.env.VITE_OPENCLAW_API_BASE_URL || 'https://walrus-app-z3vsf.ondigitalocean.app').replace(/\/+$/, '')

const SESSION_KEY = 'apixlab_session'
const ADMIN_SESSION_KEY = 'apixlab_admin_session'
const INITIAL_SESSION = { token: null, userId: null, profileName: '' }
const INITIAL_ADMIN_SESSION = { token: null, adminId: null, username: '', role: '', expiresAt: '' }
const ADMIN_LOGIN_PATH = '/admin/login'
const SECRET_FIELD_DEFINITIONS = [
  { key: 'CLAWCHEF_VAR_OPENAI_API_KEY', label: 'OpenAI API Key', kind: 'api', required: true },
  { key: 'GEMINI_API_KEY', label: 'Gemini API Key', kind: 'api', required: true },
  { key: 'CLAWCHEF_VAR_SINGULARITY_MAIN_TELEGRAM_BOT_KEY', label: '主编 Bot Token', kind: 'bot', required: true },
  { key: 'CLAWCHEF_VAR_SINGULARITY_REVIEWER_TELEGRAM_BOT_KEY', label: '审核 Bot Token', kind: 'bot', required: true },
  { key: 'CLAWCHEF_VAR_SINGULARITY_WRITER_TELEGRAM_BOT_KEY', label: '写手 Bot Token', kind: 'bot', required: false },
  { key: 'CLAWCHEF_VAR_SINGULARITY_VIDEO_TELEGRAM_BOT_KEY', label: '视频 Bot Token', kind: 'bot', required: true },
]
const SINGULARITY_WORKFLOW_ID = 'singularity-studio'
const SINGULARITY_WORKFLOW_OWNER = 'Jim（tg：@jimMao0x1）'
const SINGULARITY_WORKFLOW_METRICS = [
  { label: 'agent数量', value: '5 个' },
  { label: '负责人', value: SINGULARITY_WORKFLOW_OWNER },
  { label: '上线渠道', value: 'openclaw-tgbot' },
]
const SINGULARITY_WORKFLOW_PHASES = [
  '选题确认：主编收束命题方向，确认本轮内容要解决的核心问题。',
  '故事印证：补事实、原典、案例与反例，为后续论证准备材料。',
  '正反对垒：Sentinel 自动发起论证，Adversary 自动多轮审辩与挑战。',
  '升级解读：主编整理冲突后的判断，沉淀 rejected logic log 与升级观点。',
  '草稿循环：writer 自动起草，reviewer 自动审稿，直到主编确认可发布。',
  '正式定稿：final-writer 生成正式稿，主编完成最后确认与出街准备。',
]
const SINGULARITY_USAGE_STEPS = [
  '部署前先准备 OpenAI API Key、Gemini API Key、主编 Bot、审核 Bot、视频 Bot；写手 Bot 可选，不填时不会阻塞首发部署。',
  '点击“新建并部署”，填写频道信息和首发密钥；系统会自动补齐 K8s 默认镜像、Ingress、PVC 和镜像拉取配置。',
  '等待首发部署完成。首次冷启动会执行 clawchef cook、workspace 初始化和 gateway 启动，所以通常比后续重部署更久。',
  '部署成功后进入“我的频道”，先确认运行状态、健康状态、公开入口和最近任务都已经正常。',
  '如果只改了配置，直接在频道里修改部署配置即可；如果要强制重建 Pod 但保留 PVC，使用“深度重新部署”。',
  '删除频道会清理实例并归档频道，部署配置、审核记录和任务历史会保留。',
]
const SINGULARITY_BOT_USAGE = [
  '群里至少拉入主编 Bot、审核 Bot、视频生成 Bot。',
  '群内主要通过 @主编 Bot 发起流程。常见入口是“直接立项 …”、“继续”或直接回复菜单数字，主编会推进 step 3 到 step 8。',
  '审核 Bot、写手 Bot、final-writer 大多数时候由工作流自动触发，不需要用户手动逐个 @ 来切步骤。',
  '视频 Bot 只负责“文案转视频”这条支线。需要生成视频时，可以等待上游把 /handle 流程转给它；如果已经有成文，也可以直接 @它生成视频。',
  '工作流自动流转时可能会有短暂处理等待，通常稍等片刻就会返回下一步输出。',
]
const SINGULARITY_ASSET_USAGE = [
  {
    title: '热点采集',
    actor: '@主编 Bot',
    command: '先说“定义采集 …”定义采集方法，再说“跑热点”“看简报”或“提炼候选观点”。如果命题已经明确，也可以直接说“直接立项 …”。',
    result: '主编会按你定义的方法跑热点、产出简报、提炼候选命题，并把结果带回当前工作流。',
    example: '例子：`@主编 Bot 定义采集：每天抓 AI、科幻哲学、平台热议，给我 5 条可写命题。` 然后再说 `@主编 Bot 跑热点`。',
    storage: '热点简报和过程会先进入当前项目的 `interaction_log.md`、`materials.md`，后续被主编挑中的命题再推进到正式项目步骤。',
  },
  {
    title: '素材包接入',
    actor: '@主编 Bot',
    command: '先说“素材包”查看当前已绑定素材包和可用操作；新增时说“保存素材包 …”，项目里接入时说“绑定素材包 …”。',
    result: '主编会把素材包登记进共享素材库，并把指定素材包绑定到当前项目，供后续写作阶段调用。',
    example: '例子：`@主编 Bot 保存素材包 black-myth-core，包含黄风大圣、白象、狮驼岭相关设定文件。` 保存后再说 `@主编 Bot 绑定素材包 black-myth-core`。',
    storage: '共享素材包会进入 `/.openclaw/shared/source-packs/<pack_id>/`，当前项目里只记录“绑定了哪些素材包”，不会整包复制进项目目录。',
  },
  {
    title: '素材包检索',
    actor: '@主编 Bot',
    command: '在项目过程中直接说“查素材包 …”，把你要找的概念、人物、设定或案例写在后面。',
    result: '主编会去已绑定素材包里检索匹配内容，再把摘要和可直接使用的片段带回当前项目。',
    example: '例子：`@主编 Bot 查素材包 白象设定`，或者 `@主编 Bot 查素材包 适合写“权力感来自羞辱史”的人物案例`。',
    storage: '检索结果不会把整个素材包搬进项目，而是写到当前项目的 `source_pack_queries.json`，里面保存 query、命中文件、摘要和可直接引用的全文片段。',
  },
  {
    title: '文章模板',
    actor: '@主编 Bot',
    command: '当你看到一篇文章写得很好时，把文章链接或原文直接发给主编 Bot，并明确说“保存为模板”。如果你已经想好模板名，也可以一并告诉它。',
    result: '主编会先分析这篇文章的结构、节奏、导语、段落推进和写作方法，再把“原文 + 模板分析”保存成可复用模板。后续进入写稿阶段时，可以选择要绑定哪一个模板。',
    example: '例子：`@主编 Bot 把这篇文章保存为模板：https://example.com/article-1，模板名叫 dark-fantasy-soft-article-v1。` 或者直接把整篇原文贴给主编 Bot，再说“保存为模板”。',
    storage: '模板会保存到 `/.openclaw/shared/templates/articles/<template_id>.md`。这个文件不只是文章正文，还会包含主编提炼出来的结构、节奏和写作方法。项目里只绑定 `template_id`，写稿时由 writer / reviewer 按绑定模板读取。',
  },
  {
    title: '知识库（写作规则 / 审稿门禁 / 修稿模式）',
    actor: '@主编 Bot',
    command: '知识库分三类，录入时直接按类型对主编 Bot 说。1）写作规则：用于“以后写稿都尽量这么写”，口令是“保存写作规则：…”。2）审稿门禁：用于“出现什么问题就不能过稿”，口令是“保存门禁：…”。3）修稿模式：用于“遇到某类问题时怎么改”，口令是“保存修稿模式：…”。如果你只知道这条经验很重要，但不确定放哪类，也可以先说“写进知识库”，再让主编帮你归类。',
    result: '主编会先把这条经验归档到对应部分，再在后续流程里按角色分发。`writing_rules/` 会在 step 7 草稿阶段前交给 writer，影响首稿写法；`review_gates/` 会在 reviewer 审稿前加载，决定什么稿件必须打回；`repair_patterns/` 会在 reviewer 给出修改意见时一起加载，帮助它把“问题”转成“怎么改”的明确建议。final-writer 不直接通读整个共享知识库，而是只接当前项目已经整理好的最终修改要求。',
    example: '实际案例：如果你想固定一种写法，就说 `@主编 Bot 保存写作规则：写黑暗幻想时，正文必须从人物困境切入，先给代价，再给观点，不要一上来空讲世界观。` 如果你想加一道审稿红线，就说 `@主编 Bot 保存门禁：只要人物选择没有真实代价，就一律不通过审稿。` 如果你总结出一种常见修法，就说 `@主编 Bot 保存修稿模式：遇到结尾只剩观点总结时，补一个人物动作或代价回声来收束。`',
    storage: '知识库会写进三块固定目录。`/.openclaw/shared/knowledge/writing_rules/`：长期写作方法，主要在 writer 起草前消费；`/.openclaw/shared/knowledge/review_gates/`：审稿门禁，主要在 reviewer 开始审稿前消费；`/.openclaw/shared/knowledge/repair_patterns/`：修稿模式，主要在 reviewer 形成修改意见时消费。你只需要告诉主编“记什么”，不需要自己管理这些目录。',
  },
  {
    title: '使用原则',
    actor: '@主编 Bot',
    command: '你只需要明确说“要保存什么”或“要查什么”，不需要自己管理文件、路径和底层库结构。',
    result: '主编会统一负责写入、绑定、查询和调度这些知识资产，用户只看结果和下一步动作。',
    example: '例子：不要自己说“去改 templates/articles 里的某个文件”，而是直接说 `@主编 Bot 保存模板`、`@主编 Bot 查素材包 …`、`@主编 Bot 保存写作规则 …`。',
    storage: '项目运行文件和共享知识库是分开的：项目内容存在当前项目目录里，共享知识资产存在 `/.openclaw/shared/` 下对应库中。',
  },
]
const SINGULARITY_KNOWLEDGE_STRUCTURE = [
  {
    title: '共享素材层',
    path: '/.openclaw/shared/source-packs/',
    detail: '这里存原始素材包。每个素材包都有自己的 `PACK.md`、`GUIDE.md` 和原始资料文件，适合长期积累世界观、设定集、案例库。',
  },
  {
    title: '共享模板层',
    path: '/.openclaw/shared/templates/articles/',
    detail: '这里存文章模板。每个模板通常来自“用户认可的一篇文章链接或原文”，并附带主编提炼出来的结构、节奏、导语和写法分析，供 writer / reviewer 在草稿阶段选择和参考。',
  },
  {
    title: '共享知识库层',
    path: '/.openclaw/shared/knowledge/',
    detail: '这里不是一个大杂烩，而是三块分开的知识库。`writing_rules/` 记录“以后写稿都该怎么写”的方法论，例如“先给困境再给观点”，通常由“保存写作规则”录入，在 step 7 起草前被 writer 消费。`review_gates/` 记录“什么情况绝不能过稿”的门禁，例如“没有代价感就打回”，通常由“保存门禁”录入，在 reviewer 开始审稿前消费。`repair_patterns/` 记录“遇到某类问题时怎么修”的修稿模式，例如“结尾空掉时补动作回声”，通常由“保存修稿模式”录入，在 reviewer 生成修改意见时消费。',
  },
  {
    title: '当前项目层',
    path: '/.openclaw/shared/projects/<project_id>/',
    detail: '这里存这一个项目的运行过程：`project.md`、`materials.md`、`handoff.md`、`output.md`、`final-output.md`、`draft_review_history.md`。检索过的素材包结果也会进入这里的 `source_pack_queries.json`。',
  },
]

const SessionContext = createContext({
  session: INITIAL_SESSION,
  adminSession: INITIAL_ADMIN_SESSION,
  setSession: () => undefined,
  setAdminSession: () => undefined,
})

const STATUS_LABELS = {
  admin: '管理员审核',
  accepted: '已受理',
  active: '已启用',
  applied: '已落地',
  apply_failed: '落地失败',
  archived: '已归档',
  auto: '自动部署',
  approved: '已通过',
  cancel_requested: '取消中',
  cancelled: '已取消',
  channel_create: '创建频道',
  channel_join: '加入频道',
  channel_owner: '频道 Owner 审核',
  closed: '已关闭',
  created: '已创建',
  degraded: '降级',
  deleted: '已删除',
  deleting: '删除中',
  docker: 'Docker',
  docker_light_redeploy: '重新部署',
  docker_redeploy: '深度重新部署',
  draft: '草稿',
  external: '独立入口',
  failed: '失败',
  healthy: '健康',
  k8s: 'Kubernetes',
  k8s_deploy: 'K8s 首发部署',
  k8s_redeploy: '重新部署',
  k8s_deep_redeploy: '深度重新部署',
  legacy_seed: '遗留导入',
  manual: '独立部署',
  none: '无需落地',
  open: '开放申请',
  paused: '已暂停',
  pending: '待处理',
  private: '私有',
  probe: '探针发现',
  provisioning: '部署中',
  public: '公开',
  queued: '排队中',
  rejected: '已驳回',
  retry_waiting: '等待重试',
  review: '需审核',
  running: '运行中',
  apply_started: '开始落地',
  stopped: '已停止',
  succeeded: '成功',
  telegram: 'Telegram',
  unhealthy: '异常',
  unknown: '未知',
  unlisted: '不公开',
}

const ACTIVE_DEPLOY_TASK_STATUSES = new Set([
  'accepted',
  'queued',
  'retry_waiting',
  'running',
  'cancel_requested',
])

function readStoredSession() {
  try {
    const stored = localStorage.getItem(SESSION_KEY)
    return stored ? { ...INITIAL_SESSION, ...JSON.parse(stored) } : INITIAL_SESSION
  } catch {
    return INITIAL_SESSION
  }
}

function readStoredAdminSession() {
  try {
    const stored = localStorage.getItem(ADMIN_SESSION_KEY)
    if (!stored) {
      return INITIAL_ADMIN_SESSION
    }
    const session = { ...INITIAL_ADMIN_SESSION, ...JSON.parse(stored) }
    if (isAdminSessionExpired(session)) {
      localStorage.removeItem(ADMIN_SESSION_KEY)
      return INITIAL_ADMIN_SESSION
    }
    return session
  } catch {
    return INITIAL_ADMIN_SESSION
  }
}

function isAdminSessionExpired(adminSession) {
  const expiresAt = String(adminSession?.expiresAt || '').trim()
  if (!expiresAt) {
    return false
  }
  const expiresAtMs = new Date(expiresAt).getTime()
  return Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()
}

function invalidateAdminSessionAndRedirect() {
  localStorage.removeItem(ADMIN_SESSION_KEY)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('admin-session-invalidated'))
    if (window.location.pathname !== ADMIN_LOGIN_PATH) {
      window.location.assign(ADMIN_LOGIN_PATH)
    }
  }
}

function SessionProvider({ children }) {
  const [session, setSession] = useState(readStoredSession)
  const [adminSession, setAdminSession] = useState(readStoredAdminSession)

  useEffect(() => {
    if (!session.token && !session.userId && !session.profileName) {
      localStorage.removeItem(SESSION_KEY)
      return
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  }, [session])

  useEffect(() => {
    if (!adminSession.token && !adminSession.adminId && !adminSession.username && !adminSession.role && !adminSession.expiresAt) {
      localStorage.removeItem(ADMIN_SESSION_KEY)
      return
    }
    localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(adminSession))
  }, [adminSession])

  useEffect(() => {
    const handleAdminSessionInvalidated = () => {
      setAdminSession(INITIAL_ADMIN_SESSION)
    }
    window.addEventListener('admin-session-invalidated', handleAdminSessionInvalidated)
    return () => {
      window.removeEventListener('admin-session-invalidated', handleAdminSessionInvalidated)
    }
  }, [setAdminSession])

  return (
    <SessionContext.Provider value={{ session, adminSession, setSession, setAdminSession }}>
      {children}
    </SessionContext.Provider>
  )
}

function useSessionState() {
  return useContext(SessionContext)
}

async function requestApi(path, init = {}, token = '') {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  })

  const rawText = await response.text()
  const payload = rawText ? safeParseJson(rawText) : null

  if (!response.ok || (payload && typeof payload === 'object' && payload.success === false)) {
    const message = typeof payload === 'string'
      ? payload
      : payload?.message
        || payload?.error
        || payload?.errors?.[0]?.message
        || `请求失败：HTTP ${response.status}`
    if (response.status === 401 && String(token || '').startsWith('adm_') && /Invalid admin token/i.test(String(message || ''))) {
      invalidateAdminSessionAndRedirect()
    }
    throw new Error(message)
  }

  return payload
}

function safeParseJson(value) {
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function formatDate(value) {
  if (!value) {
    return '未记录'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function formatDurationMs(value) {
  const normalized = Number(value)
  if (!Number.isFinite(normalized) || normalized < 0) {
    return '未记录'
  }
  if (normalized < 1000) {
    return `${Math.round(normalized)} ms`
  }
  if (normalized < 60_000) {
    return `${(normalized / 1000).toFixed(normalized >= 10_000 ? 0 : 1)} s`
  }
  return `${(normalized / 60_000).toFixed(normalized >= 600_000 ? 0 : 1)} min`
}

function formatStatus(value) {
  const normalized = String(value || '').trim()
  if (!normalized) {
    return '未配置'
  }
  return STATUS_LABELS[normalized] || normalized
}

function isActiveDeployTaskStatus(status) {
  return ACTIVE_DEPLOY_TASK_STATUSES.has(String(status || '').trim())
}

function formatValue(value) {
  if (Array.isArray(value)) {
    return value.length ? value.join(', ') : '未配置'
  }
  if (value == null || value === '') {
    return '未配置'
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

function isMissingEndpointError(error) {
  const message = String(error?.message || '')
  return message.includes('HTTP 404') || message.includes('Not Found') || message.includes('Cannot GET')
}

function summarizeChannel(channel) {
  return channel?.summary || channel?.descriptionPublic || '暂未填写公开说明。'
}

function resolveChannelRouteId(channel) {
  return channel.slug || channel.id
}

function getChannelLinkLabel(channel, options = {}) {
  const primaryUrl = getChannelPrimaryActionUrl(channel, options)
  if (!primaryUrl) {
    return ''
  }
  const telegramUrl = getChannelTelegramUrl(channel, options)
  return telegramUrl && primaryUrl === telegramUrl ? '加入频道' : '打开入口'
}

function getChannelDeploymentMode(channel) {
  return channel?.deploymentMode || channel?.runtime?.deploymentMode || ''
}

function getChannelTgGroupId(channel, options = {}) {
  if (channel?.tgGroupId) {
    return channel.tgGroupId
  }
  return options.allowRuntimeFallback ? (channel?.runtime?.tgGroupId || '') : ''
}

function getChannelTelegramUrl(channel, options = {}) {
  const publicUrl = String(channel?.publicUrl || '').trim()
  if (publicUrl && /(^https?:\/\/)?(t\.me|telegram\.me)\//i.test(publicUrl)) {
    return publicUrl
  }

  const tgGroupId = String(getChannelTgGroupId(channel, options) || '').trim().replace(/^telegram:/i, '')
  if (!tgGroupId) {
    return ''
  }

  const normalized = tgGroupId.startsWith('-100')
    ? tgGroupId.slice(4)
    : tgGroupId.startsWith('-')
      ? tgGroupId.slice(1)
      : tgGroupId

  return normalized ? `https://t.me/c/${normalized}/1` : ''
}

function getChannelPrimaryActionUrl(channel, options = {}) {
  const telegramUrl = getChannelTelegramUrl(channel, options)
  if (telegramUrl) {
    return telegramUrl
  }

  const publicUrl = String(channel?.publicUrl || '').trim()
  return publicUrl || ''
}

function getChannelInviteAccess(channel) {
  return {
    canViewInvite: Boolean(channel?.canViewInvite),
    currentUserJoinStatus: String(channel?.currentUserJoinStatus || 'none').trim() || 'none',
    currentReviewRequestId: String(channel?.currentReviewRequestId || '').trim() || null,
  }
}

function getReviewRequestDeploymentMode(reviewRequest) {
  const normalizedMode = String(reviewRequest?.requestPayload?.deployment?.mode || '').trim().toLowerCase()
  return normalizedMode === 'manual' ? 'manual' : 'auto'
}

function getChannelJoinActionState(channel, token = '') {
  const access = getChannelInviteAccess(channel)
  if (channel?.applicationMode === 'review') {
    if (!token) {
      return {
        kind: 'login',
        label: '登录后申请',
        helper: '连接钱包并完成登录后，才能向频道 owner 提交加入申请。',
      }
    }
    if (access.currentUserJoinStatus === 'pending') {
      return {
        kind: 'pending',
        label: '审核中',
        helper: '加入申请已经提交，等待频道 owner 审核。',
      }
    }
    if (access.canViewInvite) {
      const joinUrl = getChannelTelegramUrl(channel)
      if (joinUrl) {
        return {
          kind: 'link',
          label: '加入频道',
          helper: '',
          href: joinUrl,
        }
      }
      return {
        kind: 'unavailable',
        label: '',
        helper: '频道入口还没有准备好，等探测到 TG 群 ID 后再显示。',
      }
    }
    if (access.currentUserJoinStatus === 'approved') {
      const joinUrl = getChannelTelegramUrl(channel)
      if (joinUrl) {
        return {
          kind: 'link',
          label: '加入频道',
          helper: '',
          href: joinUrl,
        }
      }
      return {
        kind: 'unavailable',
        label: '',
        helper: '你已经通过审核，但频道入口还没有准备好。',
      }
    }
    if (access.currentUserJoinStatus === 'rejected') {
      return {
        kind: 'apply',
        label: '重新申请加入',
        helper: '上一次申请未通过，可以重新提交申请。',
      }
    }
    return {
      kind: 'apply',
      label: '申请加入',
      helper: '提交后需要频道 owner 审核，通过后才会展示群入口。',
    }
  }

  const joinUrl = getChannelTelegramUrl(channel)
  if (joinUrl) {
    return {
      kind: 'link',
      label: '加入频道',
      helper: '',
      href: joinUrl,
    }
  }

  if (channel?.applicationMode === 'closed') {
    return {
      kind: 'closed',
      label: '暂停加入',
      helper: '当前频道关闭了新的加入申请。',
    }
  }

  return {
    kind: 'unavailable',
    label: '暂未开放',
    helper: '当前还没有可用的加入入口。',
  }
}

function buildReviewRequestContext(reviewRequest) {
  const parts = [
    formatStatus(reviewRequest?.requestType),
    reviewRequest?.workflowId || '',
    reviewRequest?.subjectKey || reviewRequest?.subjectId || '',
  ].filter(Boolean)
  return parts.join(' · ') || '审核请求'
}

function getReviewRequestDetailPath(reviewRequestId, options = {}) {
  const normalizedReviewRequestId = String(reviewRequestId || '').trim()
  if (!normalizedReviewRequestId) {
    return options.admin ? '/admin/review-requests' : '/me/review-requests'
  }
  return options.admin
    ? `/admin/review-requests/${encodeURIComponent(normalizedReviewRequestId)}`
    : `/me/review-requests/${encodeURIComponent(normalizedReviewRequestId)}`
}

function looksLikeEthAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value || '').trim())
}

function getReviewRequesterWallet(reviewRequest) {
  const requester = reviewRequest?.requester || {}
  const explicitWallet = String(requester.ethAddress || '').trim()
  if (explicitWallet) {
    return explicitWallet
  }
  const nameValue = String(requester.name || '').trim()
  return looksLikeEthAddress(nameValue) ? nameValue : ''
}

function getReviewRequesterName(reviewRequest) {
  const nameValue = String(reviewRequest?.requester?.name || '').trim()
  if (!nameValue || looksLikeEthAddress(nameValue)) {
    return ''
  }
  return nameValue
}

function getReviewStatusTone(value) {
  const normalized = String(value || '').trim()
  if (normalized === 'approved' || normalized === 'applied') {
    return 'success'
  }
  if (normalized === 'rejected' || normalized === 'apply_failed') {
    return 'danger'
  }
  if (normalized === 'pending' || normalized === 'accepted' || normalized === 'queued' || normalized === 'running') {
    return 'warning'
  }
  if (normalized === 'cancelled' || normalized === 'none') {
    return 'muted'
  }
  return 'default'
}

function mergeManagedChannelView(channel, managedChannels = []) {
  if (!channel || !Array.isArray(managedChannels) || managedChannels.length === 0) {
    return channel
  }
  const match = managedChannels.find((managedChannel) => (
    (channel.id && managedChannel?.id === channel.id)
    || (channel.slug && managedChannel?.slug === channel.slug)
  ))
  if (!match) {
    return channel
  }
  return {
    ...channel,
    ...match,
    canViewInvite: true,
    currentUserJoinStatus: 'approved',
    currentReviewRequestId: null,
  }
}

function sanitizeDeployConfigRequest(config) {
  if (!config?.request || typeof config.request !== 'object' || Array.isArray(config.request)) {
    return {}
  }

  return sanitizeRequestObject(config.request)
}

function sanitizeRequestObject(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    return {}
  }

  const cloned = JSON.parse(JSON.stringify(request))
  delete cloned.secretEnv
  delete cloned.channelId
  return cloned
}

function mergeRequestPatch(base, patch) {
  const result = JSON.parse(JSON.stringify(base || {}))

  Object.entries(patch || {}).forEach(([key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value) && result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])) {
      result[key] = mergeRequestPatch(result[key], value)
      return
    }
    result[key] = value
  })

  return result
}

function buildSecretFieldStates(secretEnvKeys = []) {
  return SECRET_FIELD_DEFINITIONS.map((field) => ({
    ...field,
    configured: secretEnvKeys.includes(field.key),
  }))
}

function buildSecretPatch(secretDrafts) {
  return Object.entries(secretDrafts || {}).reduce((result, [key, value]) => {
    const normalized = String(value || '').trim()
    if (normalized) {
      result[key] = normalized
    }
    return result
  }, {})
}

function parseTagInput(value) {
  return String(value || '')
    .split(/[\n,，]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeChannelSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function buildReleaseName(slug) {
  const base = normalizeChannelSlug(slug).slice(0, 30) || 'channel'
  const now = new Date()
  const stamp = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    String(now.getUTCDate()).padStart(2, '0'),
    String(now.getUTCHours()).padStart(2, '0'),
    String(now.getUTCMinutes()).padStart(2, '0'),
    String(now.getUTCSeconds()).padStart(2, '0'),
  ].join('')
  const nonce = Math.random().toString(36).slice(2, 6)
  return `${base}-${stamp}-${nonce}`
}

function resolveBootstrapRequest(channel, config, tasks) {
  if (config) {
    return sanitizeDeployConfigRequest(config)
  }

  const latestTaskWithRequest = (tasks || []).find((task) => task?.requestPayload && typeof task.requestPayload === 'object' && !Array.isArray(task.requestPayload))
  const base = sanitizeRequestObject(latestTaskWithRequest?.requestPayload)

  if (channel?.targetKind === 'k8s') {
    if (!base.releaseName && channel.releaseName) {
      base.releaseName = channel.releaseName
    }
    if (!base.namespace && channel.namespace) {
      base.namespace = channel.namespace
    }
  }

  if (channel?.targetKind === 'docker' && !base.instanceName && channel.instanceName) {
    base.instanceName = channel.instanceName
  }

  return base
}

function buildTaskSuccessMessage(task) {
  const taskId = String(task?.taskId || task?.id || '').trim()
  return taskId ? `已提交部署任务 ${taskId}` : '已提交部署任务。'
}

function getDeployTaskResourceLabel(task) {
  return [task?.namespace, task?.releaseName].filter(Boolean).join(' / ') || task?.instanceName || '未绑定资源'
}

function resolveActiveChannelTask(tasks, currentTaskId) {
  const normalizedCurrentTaskId = String(currentTaskId || '').trim()
  if (normalizedCurrentTaskId) {
    const currentTask = (tasks || []).find((task) => task?.id === normalizedCurrentTaskId)
    if (currentTask && isActiveDeployTaskStatus(currentTask.status)) {
      return currentTask
    }
  }

  return (tasks || []).find((task) => isActiveDeployTaskStatus(task?.status)) || null
}

function getWorkflowOwnerName(workflow) {
  if (workflow?.id === SINGULARITY_WORKFLOW_ID) {
    return SINGULARITY_WORKFLOW_OWNER
  }

  return workflow?.ownerName || '未配置'
}

function getWorkflowMetrics(workflow) {
  if (workflow?.id === SINGULARITY_WORKFLOW_ID) {
    return SINGULARITY_WORKFLOW_METRICS
  }

  return Array.isArray(workflow?.metrics) ? workflow.metrics : []
}

function usePublicWorkflows() {
  const query = useQuery({
    queryKey: ['public-workflows'],
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const result = await requestApi('/v1/workflows')
      return Array.isArray(result?.workflows) ? result.workflows : []
    },
  })

  return {
    workflows: query.data || [],
    isLoading: query.isLoading,
    error: query.error?.message || '',
    refetch: query.refetch,
  }
}

function usePublicWorkflow(workflowId) {
  const query = useQuery({
    queryKey: ['public-workflow', workflowId],
    enabled: Boolean(workflowId),
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const result = await requestApi(`/v1/workflows/${encodeURIComponent(workflowId)}`)
      return result?.workflow || null
    },
  })

  return {
    workflow: query.data || null,
    isLoading: Boolean(workflowId) && query.isLoading,
    error: workflowId ? (query.error?.message || '') : '缺少工作流标识。',
    refetch: query.refetch,
  }
}

function usePublicChannels(workflowId = '', token = '') {
  const query = useQuery({
    queryKey: ['public-channels', workflowId, token],
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const params = new URLSearchParams()
      if (workflowId) {
        params.set('workflowId', workflowId)
      }
      const suffix = params.toString() ? `?${params.toString()}` : ''
      const result = await requestApi(`/v1/channels${suffix}`, {}, token)
      return Array.isArray(result?.channels) ? result.channels : []
    },
  })

  return {
    channels: query.data || [],
    isLoading: query.isLoading,
    error: query.error?.message || '',
    refetch: query.refetch,
  }
}

function usePublicChannel(idOrSlug, token = '') {
  const query = useQuery({
    queryKey: ['public-channel', idOrSlug, token],
    enabled: Boolean(idOrSlug),
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const result = await requestApi(`/v1/channels/${encodeURIComponent(idOrSlug)}`, {}, token)
      return result?.channel || null
    },
  })

  return {
    channel: query.data || null,
    isLoading: Boolean(idOrSlug) && query.isLoading,
    error: idOrSlug ? (query.error?.message || '') : '缺少频道标识。',
    refetch: query.refetch,
  }
}

function useMyReviewRequests(token, filters = {}) {
  const requestType = String(filters.requestType || '').trim()
  const status = String(filters.status || '').trim()
  const query = useQuery({
    queryKey: ['my-review-requests', token, requestType, status],
    enabled: Boolean(token),
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const params = new URLSearchParams()
      if (requestType) {
        params.set('requestType', requestType)
      }
      if (status) {
        params.set('status', status)
      }
      const suffix = params.toString() ? `?${params.toString()}` : ''
      try {
        const result = await requestApi(`/v1/me/review-requests${suffix}`, {}, token)
        return Array.isArray(result?.reviewRequests) ? result.reviewRequests : []
      } catch (error) {
        if (isMissingEndpointError(error)) {
          return []
        }
        throw error
      }
    },
  })

  return {
    reviewRequests: query.data || [],
    isLoading: Boolean(token) && query.isLoading,
    error: query.error?.message || '',
    refetch: query.refetch,
  }
}

function useAssignedReviewRequests(token, filters = {}) {
  const requestType = String(filters.requestType || '').trim()
  const status = String(filters.status || '').trim()
  const query = useQuery({
    queryKey: ['assigned-review-requests', token, requestType, status],
    enabled: Boolean(token),
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const params = new URLSearchParams()
      if (requestType) {
        params.set('requestType', requestType)
      }
      if (status) {
        params.set('status', status)
      }
      const suffix = params.toString() ? `?${params.toString()}` : ''
      try {
        const result = await requestApi(`/v1/me/review-requests/assigned${suffix}`, {}, token)
        return Array.isArray(result?.reviewRequests) ? result.reviewRequests : []
      } catch (error) {
        if (isMissingEndpointError(error)) {
          return []
        }
        throw error
      }
    },
  })

  return {
    reviewRequests: query.data || [],
    isLoading: Boolean(token) && query.isLoading,
    error: query.error?.message || '',
    refetch: query.refetch,
  }
}

function useReviewRequestDetail(reviewRequestId, token) {
  const query = useQuery({
    queryKey: ['review-request-detail', reviewRequestId, token],
    enabled: Boolean(reviewRequestId && token),
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const result = await requestApi(`/v1/review-requests/${encodeURIComponent(reviewRequestId)}`, {}, token)
      return {
        reviewRequest: result?.reviewRequest || null,
        events: Array.isArray(result?.events) ? result.events : [],
      }
    },
  })

  return {
    reviewRequest: query.data?.reviewRequest || null,
    events: query.data?.events || [],
    isLoading: Boolean(reviewRequestId && token) && query.isLoading,
    error: query.error?.message || '',
    refetch: query.refetch,
  }
}

function useManagedChannelJoinRequests(channelId, token, status = 'pending') {
  const query = useQuery({
    queryKey: ['managed-channel-join-requests', channelId, token, status],
    enabled: Boolean(channelId && token),
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const params = new URLSearchParams()
      if (status) {
        params.set('status', status)
      }
      const suffix = params.toString() ? `?${params.toString()}` : ''
      try {
        const result = await requestApi(`/v1/me/channels/${encodeURIComponent(channelId)}/join-requests${suffix}`, {}, token)
        return Array.isArray(result?.reviewRequests) ? result.reviewRequests : []
      } catch (error) {
        if (isMissingEndpointError(error)) {
          return []
        }
        throw error
      }
    },
  })

  return {
    reviewRequests: query.data || [],
    isLoading: Boolean(channelId && token) && query.isLoading,
    error: query.error?.message || '',
    refetch: query.refetch,
  }
}

function useManagedChannelMembers(channelId, token) {
  const query = useQuery({
    queryKey: ['managed-channel-members', channelId, token],
    enabled: Boolean(channelId && token),
    refetchOnWindowFocus: false,
    queryFn: async () => {
      try {
        const result = await requestApi(`/v1/me/channels/${encodeURIComponent(channelId)}/members`, {}, token)
        return Array.isArray(result?.memberships) ? result.memberships : []
      } catch (error) {
        if (isMissingEndpointError(error)) {
          return []
        }
        throw error
      }
    },
  })

  return {
    memberships: query.data || [],
    isLoading: Boolean(channelId && token) && query.isLoading,
    error: query.error?.message || '',
    refetch: query.refetch,
  }
}

function useAdminReviewRequests(token, filters = {}) {
  const requestType = String(filters.requestType || '').trim()
  const status = String(filters.status || '').trim()
  const query = useQuery({
    queryKey: ['admin-review-requests', token, requestType, status],
    enabled: Boolean(token),
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const params = new URLSearchParams()
      if (requestType) {
        params.set('requestType', requestType)
      }
      if (status) {
        params.set('status', status)
      }
      const suffix = params.toString() ? `?${params.toString()}` : ''
      const result = await requestApi(`/v1/admin/review-requests${suffix}`, {}, token)
      return Array.isArray(result?.reviewRequests) ? result.reviewRequests : []
    },
  })

  return {
    reviewRequests: query.data || [],
    isLoading: Boolean(token) && query.isLoading,
    error: query.error?.message || '',
    refetch: query.refetch,
  }
}

function useAdminQueueOverview(token) {
  const query = useQuery({
    queryKey: ['admin-queue-overview', token],
    enabled: Boolean(token),
    refetchOnWindowFocus: false,
    queryFn: async () => {
      try {
        const result = await requestApi('/v1/admin/queue-overview', {}, token)
        return result?.overview || null
      } catch (error) {
        if (isMissingEndpointError(error)) {
          throw new Error('当前后端还没有部署队列纵览接口，请先部署 deployer 最新版本。')
        }
        throw error
      }
    },
  })

  return {
    overview: query.data || null,
    isLoading: Boolean(token) && query.isLoading,
    error: query.error?.message || '',
    refetch: query.refetch,
  }
}

const ChannelAccessAction = ({ channel, token, onActionComplete, showHelper = false }) => {
  const navigate = useNavigate()
  const action = getChannelJoinActionState(channel, token)
  const access = getChannelInviteAccess(channel)
  const [state, setState] = useState({ kind: 'idle', message: '', reviewRequestId: '' })

  const focusLogin = () => {
    const loginAnchor = document.getElementById('header-auth-control')
    if (loginAnchor) {
      loginAnchor.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  const handleApply = async () => {
    if (!token) {
      focusLogin()
      setState({ kind: 'error', message: '请先连接钱包并完成登录。' })
      return
    }

    setState({ kind: 'loading', message: '正在提交加入申请…' })
    try {
      const result = await requestApi(
        `/v1/channels/${encodeURIComponent(channel.id)}/applications`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        },
        token,
      )
      setState({
        kind: 'success',
        message: '已提交加入申请，等待频道 owner 审核。',
        reviewRequestId: String(result?.application?.id || '').trim(),
      })
      await onActionComplete?.()
    } catch (error) {
      setState({ kind: 'error', message: error.message || '提交加入申请失败。', reviewRequestId: '' })
    }
  }

  const handleLogin = () => {
    focusLogin()
    navigate('/me/channels')
  }

  let control = null
  if (action.kind === 'link' && action.href) {
    control = (
      <a href={action.href} target="_blank" rel="noreferrer">
        {action.label}
      </a>
    )
  } else if (action.kind === 'apply') {
    control = (
      <button type="button" onClick={handleApply} disabled={state.kind === 'loading'}>
        {state.kind === 'loading' ? '提交中…' : action.label}
      </button>
    )
  } else if (action.kind === 'login') {
    control = (
      <button type="button" onClick={handleLogin}>
        {action.label}
      </button>
    )
  } else if (action.kind === 'unavailable') {
    control = null
  } else {
    control = (
      <button type="button" disabled>
        {action.label}
      </button>
    )
  }

  const reviewRequestId = state.reviewRequestId || access.currentReviewRequestId || ''
  const reviewProgressHref = reviewRequestId
    ? getReviewRequestDetailPath(reviewRequestId)
    : '/me/review-requests'
  const helperMessage = state.message || (showHelper ? action.helper : '')
  return (
    <div className="channel-access-action">
      <div className="channel-access-controls">
        {(action.kind === 'pending' || state.kind === 'success') && reviewRequestId ? (
          <Link to={reviewProgressHref} className="channel-access-secondary">
            审核中
          </Link>
        ) : (
          control
        )}
        {state.kind === 'error' && (
          <Link to={reviewProgressHref} className="channel-access-secondary">
            查看审批进度
          </Link>
        )}
      </div>
      {!!helperMessage && (
        <p className={`channel-access-note ${state.kind === 'error' ? 'error' : state.kind === 'success' ? 'success' : ''}`}>
          {helperMessage}
          {reviewRequestId ? ` 申请单：${reviewRequestId}` : ''}
        </p>
      )}
    </div>
  )
}

const ReviewRequestList = ({ reviewRequests, emptyText, actionSlot, detailBasePath = '/me/review-requests' }) => {
  if (!reviewRequests.length) {
    return <p className="panel-state">{emptyText}</p>
  }

  return (
    <div className="task-list">
      {reviewRequests.map((reviewRequest) => {
        const requesterName = getReviewRequesterName(reviewRequest)
        const requesterWallet = getReviewRequesterWallet(reviewRequest)
        const requesterPrimary = requesterName || requesterWallet
        return (
        <article key={reviewRequest.id} className="task-card">
          <div className="task-card-head">
            <div>
              <p className="task-title">{reviewRequest.title || buildReviewRequestContext(reviewRequest)}</p>
              <div className="review-status-row">
                <span className={`review-status-chip ${getReviewStatusTone(reviewRequest.status)}`}>
                  {formatStatus(reviewRequest.status)}
                </span>
                {reviewRequest.applyStatus && reviewRequest.applyStatus !== 'none' && (
                  <span className={`review-status-chip subtle ${getReviewStatusTone(reviewRequest.applyStatus)}`}>
                    {formatStatus(reviewRequest.applyStatus)}
                  </span>
                )}
                <span className="review-status-time">{formatDate(reviewRequest.createdAt)}</span>
              </div>
            </div>
            <span className="sub-chip">{formatStatus(reviewRequest.requestType)}</span>
          </div>
          <p className="task-meta">请求上下文 · {buildReviewRequestContext(reviewRequest)}</p>
          {requesterPrimary && (
            <p className="task-meta">
              申请人 · {requesterPrimary}
              {reviewRequest.requester?.id ? ` (${reviewRequest.requester.id})` : ''}
            </p>
          )}
          {requesterName && requesterWallet && <p className="task-meta">申请人钱包 · {requesterWallet}</p>}
          {reviewRequest.reviewer?.name && <p className="task-meta">审核人 · {reviewRequest.reviewer.name}</p>}
          {reviewRequest.summary && <p className="task-meta">申请说明 · {reviewRequest.summary}</p>}
          {reviewRequest.reviewNote && <p className="task-meta">审核备注 · {reviewRequest.reviewNote}</p>}
          {reviewRequest.applyError && <p className="task-error">{reviewRequest.applyError}</p>}
          <div className="task-card-actions">
            <Link to={`${detailBasePath}/${encodeURIComponent(reviewRequest.id)}`} className="ghost">
              查看审核详情
            </Link>
          </div>
          {actionSlot?.(reviewRequest)}
        </article>
        )
      })}
    </div>
  )
}

function useManagedChannels(token) {
  const query = useQuery({
    queryKey: ['managed-channels', token],
    enabled: Boolean(token),
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const result = await requestApi('/v1/me/channels', {}, token)
      return Array.isArray(result?.channels) ? result.channels : []
    },
  })

  return {
    channels: query.data || [],
    isLoading: Boolean(token) && query.isLoading,
    error: query.error?.message || '',
    refetch: query.refetch,
  }
}

function useManagedChannel(channelId, token) {
  const query = useQuery({
    queryKey: ['managed-channel', channelId, token],
    enabled: Boolean(channelId && token),
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const result = await requestApi(`/v1/me/channels/${encodeURIComponent(channelId)}`, {}, token)
      return result?.channel || null
    },
  })

  return {
    channel: query.data || null,
    isLoading: Boolean(channelId && token) && query.isLoading,
    error: query.error?.message || '',
    refetch: query.refetch,
  }
}

function useManagedChannelDeployConfig(channelId, token) {
  const query = useQuery({
    queryKey: ['managed-channel-deploy-config', channelId, token],
    enabled: Boolean(channelId && token),
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const result = await requestApi(`/v1/channels/${encodeURIComponent(channelId)}/deployment-config`, {}, token)
      return result?.config || null
    },
  })

  return {
    config: query.data || null,
    isLoading: Boolean(channelId && token) && query.isLoading,
    error: query.error?.message || '',
    refetch: query.refetch,
  }
}

function useManagedChannelTasks(channelId, token) {
  const query = useQuery({
    queryKey: ['managed-channel-tasks', channelId, token],
    enabled: Boolean(channelId && token),
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const result = await requestApi(`/v1/me/channels/${encodeURIComponent(channelId)}/tasks`, {}, token)
      return Array.isArray(result?.tasks) ? result.tasks : []
    },
  })

  return {
    tasks: query.data || [],
    isLoading: Boolean(channelId && token) && query.isLoading,
    error: query.error?.message || '',
    refetch: query.refetch,
  }
}

const Layout = ({ children }) => {
  return (
    <div className="site-shell">
      <div className="gradient-bg" aria-hidden="true" />
      <header className="site-header">
        <Link to="/" className="brand">
          <div className="brand-mark">APIX</div>
          <div>
            <p className="brand-label">APIXLab</p>
            <span className="brand-tagline">Workflow Playground</span>
          </div>
        </Link>
        <div className="header-side">
          <nav className="site-nav">
            <NavLink to="/" end>
              工作流
            </NavLink>
            <NavLink to="/me/channels">
              我的频道
            </NavLink>
            <NavLink to="/me/review-requests">
              我的审核
            </NavLink>
          </nav>
          <HeaderAuthControl />
        </div>
      </header>
      <main className="page-area">{children}</main>
      <footer className="site-footer">
        <span>© {new Date().getFullYear()} APIXLab · 以工作流为核心的实验室</span>
        <span>contact@apixlab.studio</span>
      </footer>
    </div>
  )
}

const Home = () => {
  const navigate = useNavigate()
  const { workflows, isLoading, error } = usePublicWorkflows()

  return (
    <div className="home">
      <section className="hero">
        <p className="eyebrow">APIXLab · Workflow Catalog</p>
        <h1>把灵感固化成可复用的<br />多 Agent 协同工作流</h1>
        <p className="lead">
          APIXLab 聚焦多智能体内容生产实验。所有工作流都经过实战验证，
          可直接复用到团队 SOP 或作为自建平台的模板。
        </p>
      </section>

      <section className="workflow-list">
        <div className="section-head">
          <div>
            <p className="eyebrow">工作流列表</p>
            <h2>当前可调用的工作流</h2>
          </div>
          <span className="count">{workflows.length} 套</span>
        </div>

        {isLoading && <p className="panel-state">正在加载工作流目录…</p>}
        {!isLoading && error && <p className="panel-state error">{error}</p>}
        {!isLoading && !error && workflows.length === 0 && <p className="panel-state">当前还没有可展示的工作流。</p>}

        {!isLoading && !error && workflows.length > 0 && (
          <div className="workflow-grid">
            {workflows.map((flow) => (
              <article key={flow.id} className="workflow-card">
                <div className="workflow-cta">
                  <div>
                    <p className="chip">{flow.statusLabel || '已上线'}</p>
                    <h3>{flow.name}</h3>
                    <p className="muted">{flow.description}</p>
                  </div>
                  <button type="button" onClick={() => navigate(`/workflows/${flow.id}`)}>
                    查看工作流与教程
                  </button>
                </div>
                <dl>
                  <div>
                    <dt>Owner</dt>
                    <dd>{getWorkflowOwnerName(flow)}</dd>
                  </div>
                  <div>
                    <dt>频道数</dt>
                    <dd>{flow.channelCount} 个</dd>
                  </div>
                  <div>
                    <dt>更新</dt>
                    <dd>{formatDate(flow.updatedAt)}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

const WorkflowDetail = () => {
  const { workflowId } = useParams()
  const { session } = useSessionState()
  const token = session.token || ''
  const { workflow, isLoading: isWorkflowLoading, error: workflowError } = usePublicWorkflow(workflowId)
  const { channels, isLoading: isChannelsLoading, error: channelsError, refetch: refetchChannels } = usePublicChannels(workflowId, token)
  const { channels: managedChannels } = useManagedChannels(token)
  const displayChannels = useMemo(
    () => channels.map((channel) => mergeManagedChannelView(channel, managedChannels)),
    [channels, managedChannels],
  )

  const isSingularityWorkflow = workflow?.id === SINGULARITY_WORKFLOW_ID
  const checklist = useMemo(() => (
    isSingularityWorkflow
      ? SINGULARITY_USAGE_STEPS
      : [
        '连接钱包并完成 LazAI 登录，后续需要用户态接口时可以直接带 Bearer token 调 OpenClaw。',
        '先浏览公开频道，确认实例状态、部署方式和运行入口是否符合预期。',
        '如果需要私有化频道或定制部署，再继续接用户态创建和部署接口。',
      ]
  ), [isSingularityWorkflow])

  if (isWorkflowLoading) {
    return (
      <div className="detail">
        <p className="eyebrow">Workflow</p>
        <h1>加载工作流中</h1>
        <p className="lead">正在读取工作流详情和关联频道。</p>
      </div>
    )
  }

  if (!workflow || workflowError) {
    return (
      <div className="detail">
        <p className="eyebrow">Workflow</p>
        <h1>未找到该工作流</h1>
        <p className="lead">{workflowError || '请返回主页，或联系 APIXLab 获取更多配置。'}</p>
        <Link className="primary" to="/">返回主页</Link>
      </div>
    )
  }

  const workflowMetrics = getWorkflowMetrics(workflow)
  const workflowPhases = isSingularityWorkflow
    ? SINGULARITY_WORKFLOW_PHASES
    : (Array.isArray(workflow.phases) ? workflow.phases : [])
  const workflowResources = Array.isArray(workflow.resources) ? workflow.resources : []

  return (
    <div className="detail">
      <p className="eyebrow">Workflow</p>
      <h1>{workflow.name}</h1>
      <p className="lead">{workflow.description || '暂未填写工作流说明。'}</p>

      <div className="stats">
        {[...workflowMetrics, { label: '频道', value: `${workflow.channelCount || displayChannels.length} 个` }].map((metric) => (
          <div key={metric.label}>
            <p className="stat-value">{metric.value}</p>
            <p className="stat-label">{metric.label}</p>
          </div>
        ))}
      </div>

      <section className="resources">
        <div className="section-head section-head-tight">
          <div>
            <h2>频道列表</h2>
            <p className="section-copy">当前展示的是这个 workflow 下的公开频道。你也可以直接在这里新建一个频道挂到当前 workflow。</p>
          </div>
          <div className="inline-actions">
            <Link to={`/me/channels/new?workflowId=${encodeURIComponent(workflow.id)}`}>新建并部署</Link>
          </div>
        </div>
        {isChannelsLoading && <p className="panel-state">正在加载公开频道…</p>}
        {!isChannelsLoading && channelsError && <p className="panel-state error">{channelsError}</p>}
        {!isChannelsLoading && !channelsError && displayChannels.length === 0 && <p className="panel-state">当前工作流下还没有可展示的频道。</p>}

        {!isChannelsLoading && !channelsError && displayChannels.length > 0 && (
          <div className="channel-list">
            {displayChannels.map((channel) => (
              <div key={channel.id} className="channel-item">
                <div>
                  <p className="channel-title">{channel.name}</p>
                  <p className="channel-desc">{summarizeChannel(channel)}</p>
                  <p className="channel-meta">
                    {formatStatus(channel.targetKind)} · {formatStatus(getChannelDeploymentMode(channel))} · {formatStatus(channel.lifecycleStatus)} · {formatStatus(channel.healthStatus)}
                  </p>
                  {channel.applicationMode === 'review' && !channel.canViewInvite && (
                    <p className="channel-meta">
                      加入策略 · {formatStatus(channel.applicationMode)}
                      {channel.currentUserJoinStatus && channel.currentUserJoinStatus !== 'none' ? ` · ${formatStatus(channel.currentUserJoinStatus)}` : ''}
                    </p>
                  )}
                </div>
                <div className="channel-actions">
                  <Link to={`/channels/${resolveChannelRouteId(channel)}`}>查看详情</Link>
                  <ChannelAccessAction channel={channel} token={token} onActionComplete={refetchChannels} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {workflowPhases.length > 0 && (
        <section className="phases">
          <h2>核心阶段</h2>
          <ol>
            {workflowPhases.map((phase, index) => (
              <li key={`${phase}-${index}`}>
                <span>{index + 1}</span>
                <p>{phase}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="resources">
        <h2>使用教程</h2>
        <div className="resource-links flow-guide">
          <div>
            <p className="guide-title">{isSingularityWorkflow ? '使用步骤' : '当前接入状态'}</p>
            <ol>
              {checklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </div>
          <div>
            {isSingularityWorkflow ? (
              <>
                <p className="guide-title">机器人与群内用法</p>
                <ol>
                  {SINGULARITY_BOT_USAGE.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ol>
                <p className="guide-title">知识库结构</p>
                <ol>
                  {SINGULARITY_KNOWLEDGE_STRUCTURE.map((item) => (
                    <li key={item.title} className="guide-detail-item">
                      <p><strong>{item.title}</strong></p>
                      <p><strong>路径：</strong><code>{item.path}</code></p>
                      <p><strong>作用：</strong>{item.detail}</p>
                    </li>
                  ))}
                </ol>
                <p className="guide-title">知识资产与内容积累</p>
                <ol>
                  {SINGULARITY_ASSET_USAGE.map((item) => (
                    <li key={item.title} className="guide-detail-item">
                      <p><strong>{item.title}</strong></p>
                      <p><strong>跟谁说：</strong>{item.actor}</p>
                      <p><strong>怎么说：</strong>{item.command}</p>
                      <p><strong>会发生什么：</strong>{item.result}</p>
                      <p><strong>实际案例：</strong>{item.example}</p>
                      <p><strong>会写到哪里：</strong>{item.storage}</p>
                    </li>
                  ))}
                </ol>
                <p className="guide-title">常用入口</p>
                <ul className="api-link-list">
                  <li>
                    <span>新建并部署</span>
                    <Link to={`/me/channels/new?workflowId=${encodeURIComponent(workflow.id)}`}>进入创建页</Link>
                  </li>
                  <li>
                    <span>我的频道</span>
                    <Link to="/me/channels">查看已创建频道</Link>
                  </li>
                  <li>
                    <span>频道详情</span>
                    {channels[0]
                      ? (
                        <Link to={`/channels/${resolveChannelRouteId(channels[0])}`}>打开一个频道示例</Link>
                        )
                      : (
                        <span>创建成功后可从公开频道或我的频道进入</span>
                        )}
                  </li>
                  <li>
                    <span>服务健康检查</span>
                    <a href={`${API_BASE_URL}/healthz`} target="_blank" rel="noreferrer">
                      <code>GET /healthz</code>
                    </a>
                  </li>
                </ul>
              </>
            ) : (
              <>
                <p className="guide-title">接口入口</p>
                <ul className="api-link-list">
                  <li>
                    <span>新建并部署</span>
                    <Link to={`/me/channels/new?workflowId=${encodeURIComponent(workflow.id)}`}>进入创建页</Link>
                  </li>
                  <li>
                    <span>我的频道</span>
                    <Link to="/me/channels">查看已创建频道</Link>
                  </li>
                  <li>
                    <span>公开频道列表</span>
                    <a href={`${API_BASE_URL}/v1/channels`} target="_blank" rel="noreferrer">
                      <code>GET /v1/channels</code>
                    </a>
                  </li>
                  <li>
                    <span>频道详情</span>
                    {channels[0]
                      ? (
                        <Link to={`/channels/${resolveChannelRouteId(channels[0])}`}>打开一个频道示例</Link>
                        )
                      : (
                        <span>创建成功后可从公开频道或我的频道进入</span>
                        )}
                  </li>
                  <li>
                    <span>服务健康检查</span>
                    <a href={`${API_BASE_URL}/healthz`} target="_blank" rel="noreferrer">
                      <code>GET /healthz</code>
                    </a>
                  </li>
                </ul>
              </>
            )}
          </div>
        </div>
      </section>

      {workflowResources.length > 0 && (
        <section className="resources">
          <h2>相关资源</h2>
          <div className="resource-links">
            {workflowResources.map((item) => (
              <a key={`${item.label}-${item.url}`} href={item.url.startsWith('http') ? item.url : `${API_BASE_URL}${item.url}`} target="_blank" rel="noreferrer">
                {item.label}
              </a>
            ))}
            <Link to="/me/channels">进入我的频道</Link>
          </div>
        </section>
      )}

      <Link className="primary" to="/">返回 APIXLab</Link>
    </div>
  )
}

const ChannelDetail = () => {
  const { idOrSlug } = useParams()
  const { session } = useSessionState()
  const token = session.token || ''
  const { channel, isLoading, error, refetch } = usePublicChannel(idOrSlug, token)
  const { channels: managedChannels } = useManagedChannels(token)
  const displayChannel = useMemo(
    () => mergeManagedChannelView(channel, managedChannels),
    [channel, managedChannels],
  )

  if (isLoading) {
    return (
      <div className="detail">
        <p className="eyebrow">Channel</p>
        <h1>加载频道详情中</h1>
        <p className="lead">正在请求 OpenClaw 公开频道接口。</p>
      </div>
    )
  }

  if (error || !displayChannel) {
    return (
      <div className="detail">
        <p className="eyebrow">Channel</p>
        <h1>频道详情加载失败</h1>
        <p className="lead">{error || '未找到该频道。'}</p>
        <Link className="primary" to="/">返回主页</Link>
      </div>
    )
  }

  const detailMetrics = [
    { label: '运行状态', value: formatStatus(displayChannel.lifecycleStatus) },
    { label: '健康状态', value: formatStatus(displayChannel.healthStatus) },
    { label: '部署目标', value: formatStatus(displayChannel.targetKind) },
    { label: '部署模式', value: formatStatus(getChannelDeploymentMode(displayChannel)) },
    { label: 'Owner', value: displayChannel.owner?.name || '未知' },
  ]

  const metadata = [
    { label: 'Slug', value: displayChannel.slug },
    { label: '来源标记', value: formatStatus(displayChannel.sourceType) },
    { label: 'TG 群 ID', value: getChannelTgGroupId(displayChannel) || '未配置' },
    { label: 'TG 群 ID 来源', value: formatStatus(displayChannel.tgGroupIdSource) },
    { label: '公开级别', value: formatStatus(displayChannel.visibility) },
    { label: '申请模式', value: formatStatus(displayChannel.applicationMode) },
    { label: '频道状态', value: formatStatus(displayChannel.status) },
    { label: '创建时间', value: formatDate(displayChannel.createdAt) },
    { label: '最后更新', value: formatDate(displayChannel.updatedAt) },
  ]

  const desiredSpecEntries = [
    { label: '镜像仓库', value: displayChannel.desiredSpec?.image?.repository },
    { label: '镜像标签', value: displayChannel.desiredSpec?.image?.tag },
    { label: '拉取策略', value: displayChannel.desiredSpec?.image?.pullPolicy },
    { label: 'PVC 大小', value: displayChannel.desiredSpec?.persistence?.size },
    { label: '存储类', value: displayChannel.desiredSpec?.persistence?.storageClassName },
    { label: 'Access Modes', value: displayChannel.desiredSpec?.persistence?.accessModes },
  ]

  const runtimeEntries = [
    { label: '运行摘要', value: displayChannel.runtime?.status },
    { label: '最近任务类型', value: displayChannel.runtime?.lastTaskType },
    { label: '最近任务 ID', value: displayChannel.runtime?.lastTaskId },
    { label: '当前任务 ID', value: displayChannel.runtime?.currentTaskId },
    { label: 'TG 探针状态', value: displayChannel.runtime?.tgGroupIdProbeStatus },
    { label: 'TG 探针来源', value: displayChannel.runtime?.tgGroupIdProbeSource },
    { label: 'TG 探针说明', value: displayChannel.runtime?.tgGroupIdProbeReason },
    { label: '运行时更新时间', value: formatDate(displayChannel.runtime?.updatedAt) },
    { label: '错误信息', value: displayChannel.runtime?.errorMessage || '无' },
  ]

  return (
    <div className="detail">
      <p className="eyebrow">Channel</p>
      <h1>{displayChannel.name}</h1>
      <p className="lead">{displayChannel.descriptionPublic || summarizeChannel(displayChannel)}</p>

      <div className="stats">
        {detailMetrics.map((metric) => (
          <div key={metric.label}>
            <p className="stat-value">{metric.value}</p>
            <p className="stat-label">{metric.label}</p>
          </div>
        ))}
      </div>

      <section className="resources">
        <h2>访问入口</h2>
        <div className="resource-links">
          <ChannelAccessAction channel={displayChannel} token={token} onActionComplete={refetch} showHelper />
          <a href={`${API_BASE_URL}/v1/channels/${resolveChannelRouteId(displayChannel)}`} target="_blank" rel="noreferrer">
            查看原始 JSON
          </a>
        </div>
      </section>

      <section className="resources">
        <h2>公开元数据</h2>
        <div className="meta-grid">
          {metadata.map((item) => (
            <div key={item.label} className="meta-card">
              <p>{item.label}</p>
              <strong>{formatValue(item.value)}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="resources">
        <h2>部署摘要</h2>
        <div className="meta-grid">
          {desiredSpecEntries.map((item) => (
            <div key={item.label} className="meta-card">
              <p>{item.label}</p>
              <strong>{formatValue(item.value)}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="resources">
        <h2>运行态</h2>
        <div className="meta-grid">
          {runtimeEntries.map((item) => (
            <div key={item.label} className="meta-card">
              <p>{item.label}</p>
              <strong>{formatValue(item.value)}</strong>
            </div>
          ))}
        </div>
      </section>

      {!!displayChannel.tags?.length && (
        <section className="resources">
          <h2>频道标签</h2>
          <div className="status-pills">
            {displayChannel.tags.map((tag) => (
              <span key={tag} className="sub-chip">{tag}</span>
            ))}
          </div>
        </section>
      )}

      <section className="resources">
        <h2>原始配置快照</h2>
        <div className="json-panels">
          <div>
            <p className="guide-title">desiredSpec</p>
            <pre className="json-block">{JSON.stringify(displayChannel.desiredSpec || {}, null, 2)}</pre>
          </div>
          <div>
            <p className="guide-title">runtime</p>
            <pre className="json-block">{JSON.stringify(displayChannel.runtime || {}, null, 2)}</pre>
          </div>
        </div>
      </section>

      <Link className="primary" to="/">返回频道列表</Link>
    </div>
  )
}

const LoginRequiredState = ({ title = '需要登录', description = '请先在右上角连接钱包并完成 LazAI 登录，然后再查看你的频道和维护入口。' }) => (
  <div className="detail">
    <p className="eyebrow">Workspace</p>
    <h1>{title}</h1>
    <p className="lead">{description}</p>
    <Link className="primary" to="/">返回主页</Link>
  </div>
)

const MyChannels = () => {
  const location = useLocation()
  const { session } = useSessionState()
  const token = session.token || ''
  const { channels, isLoading, error } = useManagedChannels(token)
  const { reviewRequests } = useMyReviewRequests(token)
  const flashMessage = location.state?.message || ''

  const stats = useMemo(() => {
    return [
      { label: '我的频道', value: `${channels.length} 个` },
      { label: '运行中', value: `${channels.filter((channel) => channel.lifecycleStatus === 'running').length} 个` },
      { label: '自动部署', value: `${channels.filter((channel) => getChannelDeploymentMode(channel) === 'auto').length} 个` },
      { label: '已接入 TG', value: `${channels.filter((channel) => Boolean(getChannelTgGroupId(channel, { allowRuntimeFallback: true }))).length} 个` },
      { label: '待审核请求', value: `${reviewRequests.filter((reviewRequest) => reviewRequest.status === 'pending').length} 条` },
    ]
  }, [channels, reviewRequests])

  if (!token) {
    return <LoginRequiredState title="我的频道" description="用户创建的频道列表和维护入口已经加上了，但这里是用户态接口，必须先登录。" />
  }

  return (
    <div className="detail">
      <p className="eyebrow">Workspace</p>
      <h1>我的频道</h1>
      <p className="lead">
        这里展示当前登录账号名下的频道。你可以直接进入维护页，查看部署配置、最近任务和 TG 探针状态。
      </p>

      <div className="stats">
        {stats.map((metric) => (
          <div key={metric.label}>
            <p className="stat-value">{metric.value}</p>
            <p className="stat-label">{metric.label}</p>
          </div>
        ))}
      </div>

      <section className="resources">
        <div className="section-head section-head-tight">
          <div>
            <h2>频道列表</h2>
            <p className="section-copy">当前列表来自 `GET /v1/me/channels`，只展示你自己有权限维护的频道。</p>
          </div>
          <div className="inline-actions">
            <Link to="/me/channels/new">新建并部署</Link>
          </div>
        </div>
        {!!flashMessage && <p className="auth-status success">{flashMessage}</p>}
        {isLoading && <p className="panel-state">正在加载你的频道…</p>}
        {!isLoading && error && <p className="panel-state error">{error}</p>}
        {!isLoading && !error && channels.length === 0 && <p className="panel-state">当前账号下还没有频道。</p>}

        {!isLoading && !error && channels.length > 0 && (
          <div className="channel-list">
            {channels.map((channel) => (
              <div key={channel.id} className="channel-item">
                <div>
                  <p className="channel-title">{channel.name}</p>
                  <p className="channel-desc">{summarizeChannel(channel)}</p>
                  <p className="channel-meta">
                    {formatStatus(channel.targetKind)} · {formatStatus(getChannelDeploymentMode(channel))} · {formatStatus(channel.lifecycleStatus)} · {formatStatus(channel.healthStatus)}
                  </p>
                  <p className="channel-meta">更新时间 · {formatDate(channel.updatedAt)}</p>
                  {channel.currentTaskId && <p className="channel-meta">当前任务 · {channel.currentTaskId}</p>}
                </div>
                <div className="channel-actions">
                  <Link to={`/me/channels/${channel.id}`}>维护频道</Link>
                  <Link to={`/channels/${resolveChannelRouteId(channel)}`}>公开详情</Link>
                  {getChannelPrimaryActionUrl(channel, { allowRuntimeFallback: true }) && (
                    <a href={getChannelPrimaryActionUrl(channel, { allowRuntimeFallback: true })} target="_blank" rel="noreferrer">
                      {getChannelLinkLabel(channel, { allowRuntimeFallback: true })}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

const ReviewRequestTimeline = ({ events }) => {
  if (!Array.isArray(events) || events.length === 0) {
    return <p className="panel-state">当前还没有审核事件记录。</p>
  }

  return (
    <div className="review-timeline">
      {events.map((event) => (
        <article key={event.id} className="timeline-item">
          <div className="timeline-dot" aria-hidden="true" />
          <div className="timeline-body">
            <div className="timeline-head">
              <strong>{formatStatus(event.eventType)}</strong>
              <span>{formatDate(event.createdAt)}</span>
            </div>
            {event.actor?.name && <p className="task-meta">操作人 · {event.actor.name}</p>}
            {event.payload && Object.keys(event.payload).length > 0 && (
              <pre className="json-block review-json-block">{JSON.stringify(event.payload, null, 2)}</pre>
            )}
          </div>
        </article>
      ))}
    </div>
  )
}

const ReviewRequestDetailContent = ({
  reviewRequest,
  events,
  actionState,
  onDecision,
  canApproveOrReject,
  backTo,
  backLabel,
  expectedReviewerLabel,
}) => {
  const channelPayload = reviewRequest?.requestPayload?.channel || {}
  const deploymentPayload = reviewRequest?.requestPayload?.deployment || {}
  const deploymentRequest = deploymentPayload?.request || {}
  const deploymentMode = getReviewRequestDeploymentMode(reviewRequest)
  const resultPayload = reviewRequest?.resultPayload || {}
  const secretEnvKeys = Array.isArray(reviewRequest?.secretEnvKeys) ? reviewRequest.secretEnvKeys : []
  const requesterName = getReviewRequesterName(reviewRequest)
  const requesterWallet = getReviewRequesterWallet(reviewRequest)
  const requesterPrimary = requesterName || requesterWallet || '未记录'

  return (
    <>
      <section className="resources resource-panel">
        <div className="section-head section-head-tight">
          <div>
            <h2>审核摘要</h2>
            <p className="section-copy">这里会展示申请人、当前状态、审核备注以及最终落地结果。</p>
          </div>
          <div className="inline-actions">
            <Link to={backTo}>{backLabel}</Link>
          </div>
        </div>
        {!!actionState.message && <p className={`auth-status ${actionState.state}`}>{actionState.message}</p>}
        <div className="meta-grid">
          <div className="meta-card">
            <p>审核类型</p>
            <strong>{formatStatus(reviewRequest.requestType)}</strong>
          </div>
          <div className="meta-card">
            <p>当前状态</p>
            <strong>{formatStatus(reviewRequest.status)}{reviewRequest.applyStatus && reviewRequest.applyStatus !== 'none' ? ` · ${formatStatus(reviewRequest.applyStatus)}` : ''}</strong>
          </div>
          <div className="meta-card">
            <p>申请人</p>
            <strong>{requesterPrimary}</strong>
          </div>
          <div className="meta-card">
            <p>申请人 ID</p>
            <strong>{reviewRequest.requester?.id || '未记录'}</strong>
          </div>
          <div className="meta-card">
            <p>申请人钱包</p>
            <strong>{requesterWallet || '未记录'}</strong>
          </div>
          <div className="meta-card">
            <p>审核人</p>
            <strong>{reviewRequest.reviewer?.name || expectedReviewerLabel || '未处理'}</strong>
          </div>
          <div className="meta-card">
            <p>Workflow</p>
            <strong>{reviewRequest.workflowId || '未配置'}</strong>
          </div>
          <div className="meta-card">
            <p>关联资源</p>
            <strong>{reviewRequest.subjectKey || reviewRequest.subjectId || '未配置'}</strong>
          </div>
          <div className="meta-card">
            <p>创建时间</p>
            <strong>{formatDate(reviewRequest.createdAt)}</strong>
          </div>
          <div className="meta-card">
            <p>审核时间</p>
            <strong>{formatDate(reviewRequest.reviewedAt)}</strong>
          </div>
          <div className="meta-card">
            <p>落地时间</p>
            <strong>{formatDate(reviewRequest.appliedAt)}</strong>
          </div>
        </div>
        {reviewRequest.summary && <p className="task-meta">申请说明 · {reviewRequest.summary}</p>}
        {reviewRequest.reviewNote && <p className="task-meta">审核备注 · {reviewRequest.reviewNote}</p>}
        {reviewRequest.applyError && <p className="task-error">{reviewRequest.applyError}</p>}
        {canApproveOrReject && reviewRequest.status === 'pending' && (
          <div className="task-card-actions">
            <button type="button" className="ghost" onClick={() => onDecision('approve')}>
              通过
            </button>
            <button type="button" className="ghost danger" onClick={() => onDecision('reject')}>
              驳回
            </button>
          </div>
        )}
      </section>

      <section className="resources resource-panel">
        <h2>请求内容</h2>
        <div className="meta-grid compact-meta-grid">
          <div className="meta-card">
            <p>频道名称</p>
            <strong>{channelPayload.name || reviewRequest.title || '未配置'}</strong>
          </div>
          <div className="meta-card">
            <p>频道 Slug</p>
            <strong>{channelPayload.slug || reviewRequest.subjectKey || '未配置'}</strong>
          </div>
          <div className="meta-card">
            <p>可见性 / 加入策略</p>
            <strong>{formatStatus(channelPayload.visibility)} / {formatStatus(channelPayload.applicationMode)}</strong>
          </div>
          <div className="meta-card">
            <p>部署方式 / 目标</p>
            <strong>{formatStatus(deploymentMode)} / {deploymentMode === 'manual' ? '管理员独立部署' : formatStatus(deploymentPayload.targetKind || '')}</strong>
          </div>
          <div className="meta-card">
            <p>Release Name</p>
            <strong>{deploymentMode === 'manual' ? '不需要' : (deploymentRequest.releaseName || '未配置')}</strong>
          </div>
          <div className="meta-card">
            <p>密钥字段</p>
            <strong>{deploymentMode === 'manual' ? '不需要' : (secretEnvKeys.length ? secretEnvKeys.join(', ') : '无')}</strong>
          </div>
        </div>
        {Object.keys(reviewRequest.requestPayload || {}).length > 0 && (
          <div className="json-panels review-json-panels">
            <pre className="json-block review-json-block">{JSON.stringify(reviewRequest.requestPayload, null, 2)}</pre>
            {Object.keys(resultPayload || {}).length > 0 && (
              <pre className="json-block review-json-block">{JSON.stringify(resultPayload, null, 2)}</pre>
            )}
          </div>
        )}
      </section>

      <section className="resources resource-panel">
        <h2>审核轨迹</h2>
        <ReviewRequestTimeline events={events} />
      </section>
    </>
  )
}

const MyReviewRequestsPage = () => {
  const { session } = useSessionState()
  const token = session.token || ''
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') === 'assigned' ? 'assigned' : 'submitted'
  const {
    reviewRequests: submittedRequests,
    isLoading: isSubmittedLoading,
    error: submittedError,
    refetch: refetchSubmitted,
  } = useMyReviewRequests(token)
  const {
    reviewRequests: assignedRequests,
    isLoading: isAssignedLoading,
    error: assignedError,
    refetch: refetchAssigned,
  } = useAssignedReviewRequests(token)
  const [actionState, setActionState] = useState({ state: 'idle', message: '' })

  if (!token) {
    return <LoginRequiredState title="我的审核" description="请先登录，再查看你提交过的审核申请和待你处理的审核任务。" />
  }

  const handleCancelReviewRequest = async (reviewRequestId) => {
    setActionState({ state: 'loading', message: '正在取消审核请求…' })
    try {
      await requestApi(
        `/v1/review-requests/${encodeURIComponent(reviewRequestId)}/cancel`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
        token,
      )
      await refetchSubmitted()
      setActionState({ state: 'success', message: `审核请求 ${reviewRequestId} 已取消。` })
    } catch (error) {
      setActionState({ state: 'error', message: error.message || '取消审核请求失败。' })
    }
  }

  const handleAssignedDecision = async (reviewRequestId, decision) => {
    setActionState({ state: 'loading', message: decision === 'approve' ? '正在通过审核…' : '正在驳回审核…' })
    try {
      await requestApi(
        `/v1/review-requests/${encodeURIComponent(reviewRequestId)}/${decision}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
        token,
      )
      await refetchAssigned()
      setActionState({ state: 'success', message: decision === 'approve' ? `审核 ${reviewRequestId} 已通过。` : `审核 ${reviewRequestId} 已驳回。` })
    } catch (error) {
      setActionState({ state: 'error', message: error.message || '处理审核失败。' })
    }
  }

  const activeRequests = tab === 'assigned' ? assignedRequests : submittedRequests
  const isLoading = tab === 'assigned' ? isAssignedLoading : isSubmittedLoading
  const error = tab === 'assigned' ? assignedError : submittedError

  return (
    <div className="detail">
      <p className="eyebrow">Review</p>
      <h1>我的审核</h1>
      <p className="lead">这里集中展示你提交过的审核申请，以及需要你作为频道 owner 处理的加入审核。</p>

      <section className="resources resource-panel">
        <div className="section-head section-head-tight">
          <div>
            <h2>审核列表</h2>
            <p className="section-copy">申请人、请求上下文、审核状态和详情入口都会在这里统一展示；你处理过的审核也会保留在列表中。</p>
          </div>
          <div className="inline-actions">
            <button type="button" className={tab === 'submitted' ? 'active-filter' : ''} onClick={() => setSearchParams({ tab: 'submitted' })}>
              我提交的
            </button>
            <button type="button" className={tab === 'assigned' ? 'active-filter' : ''} onClick={() => setSearchParams({ tab: 'assigned' })}>
              由我审批
            </button>
          </div>
        </div>
        {!!actionState.message && <p className={`auth-status ${actionState.state}`}>{actionState.message}</p>}
        {isLoading && <p className="panel-state">正在加载审核列表…</p>}
        {!isLoading && error && <p className="panel-state error">{error}</p>}
        {!isLoading && !error && (
          <ReviewRequestList
            reviewRequests={activeRequests}
            emptyText={tab === 'assigned' ? '当前还没有分配给你的审核请求。' : '当前还没有提交过审核请求。'}
            actionSlot={(reviewRequest) => (
              <div className="task-card-actions">
                {tab === 'submitted' && reviewRequest.resultPayload?.channelId && (
                  <Link to={`/me/channels/${reviewRequest.resultPayload.channelId}`} className="ghost">
                    查看频道
                  </Link>
                )}
                {tab === 'submitted' && reviewRequest.status === 'pending' && (
                  <button type="button" className="ghost" onClick={() => handleCancelReviewRequest(reviewRequest.id)}>
                    取消申请
                  </button>
                )}
                {tab === 'assigned' && reviewRequest.status === 'pending' && (
                  <>
                    <button type="button" className="ghost" onClick={() => handleAssignedDecision(reviewRequest.id, 'approve')}>
                      通过
                    </button>
                    <button type="button" className="ghost danger" onClick={() => handleAssignedDecision(reviewRequest.id, 'reject')}>
                      驳回
                    </button>
                  </>
                )}
              </div>
            )}
          />
        )}
      </section>
    </div>
  )
}

const ReviewRequestDetailPage = () => {
  const { reviewRequestId } = useParams()
  const { session } = useSessionState()
  const token = session.token || ''
  const {
    reviewRequest,
    events,
    isLoading,
    error,
    refetch,
  } = useReviewRequestDetail(reviewRequestId, token)
  const subjectRouteId = reviewRequest?.subjectKey || reviewRequest?.subjectId || ''
  const { channel: subjectChannel } = usePublicChannel(subjectRouteId, token)
  const [actionState, setActionState] = useState({ state: 'idle', message: '' })

  if (!token) {
    return <LoginRequiredState title="审核详情" description="请先登录，再查看审核详情和审批轨迹。" />
  }

  const canApproveOrReject = Boolean(
    reviewRequest
    && reviewRequest.status === 'pending'
    && reviewRequest.reviewerScope === 'channel_owner'
    && reviewRequest.requester?.id !== session.userId,
  )

  const expectedReviewerLabel = reviewRequest?.reviewer?.name
    || (reviewRequest?.reviewerScope === 'admin'
      ? '管理员审核'
      : reviewRequest?.reviewerScope === 'channel_owner'
        ? (String(subjectChannel?.owner?.name || '').trim() ? `${String(subjectChannel?.owner?.name || '').trim()}（频道 owner）` : '频道 owner')
        : '未处理')

  const handleDecision = async (decision) => {
    setActionState({ state: 'loading', message: decision === 'approve' ? '正在通过审核…' : '正在驳回审核…' })
    try {
      await requestApi(
        `/v1/review-requests/${encodeURIComponent(reviewRequestId)}/${decision}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
        token,
      )
      await refetch()
      setActionState({ state: 'success', message: decision === 'approve' ? `审核 ${reviewRequestId} 已通过。` : `审核 ${reviewRequestId} 已驳回。` })
    } catch (requestError) {
      setActionState({ state: 'error', message: requestError.message || '处理审核失败。' })
    }
  }

  if (isLoading) {
    return (
      <div className="detail">
        <p className="eyebrow">Review</p>
        <h1>加载审核详情中</h1>
        <p className="lead">正在读取审核单、审核轨迹和上下文信息。</p>
      </div>
    )
  }

  if (!reviewRequest || error) {
    return (
      <div className="detail">
        <p className="eyebrow">Review</p>
        <h1>未找到该审核请求</h1>
        <p className="lead">{error || '请返回审核列表重新选择。'}</p>
        <Link className="primary" to="/me/review-requests">返回我的审核</Link>
      </div>
    )
  }

  return (
    <div className="detail">
      <p className="eyebrow">Review</p>
      <h1>{reviewRequest.title || '审核详情'}</h1>
      <p className="lead">这里展示这条审核请求的完整信息、申请人、审核轨迹，以及当前可执行的审批动作。</p>
      <ReviewRequestDetailContent
        reviewRequest={reviewRequest}
        events={events}
        actionState={actionState}
        onDecision={handleDecision}
        canApproveOrReject={canApproveOrReject}
        backTo="/me/review-requests"
        backLabel="返回我的审核"
        expectedReviewerLabel={expectedReviewerLabel}
      />
    </div>
  )
}

const CreateManagedChannel = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { session } = useSessionState()
  const token = session.token || ''
  const { workflows, isLoading: isWorkflowsLoading, error: workflowsError } = usePublicWorkflows()
  const presetWorkflowId = new URLSearchParams(location.search).get('workflowId') || ''
  const [form, setForm] = useState({
    workflowId: presetWorkflowId || 'singularity-studio',
    name: '',
    slug: '',
    summary: '',
    descriptionPublic: '',
    visibility: 'public',
    applicationMode: 'open',
    deploymentMode: 'auto',
    tags: '',
  })
  const [secretDrafts, setSecretDrafts] = useState({})
  const [submitState, setSubmitState] = useState({ state: 'idle', message: '' })

  const workflowOptions = useMemo(() => {
    const options = Array.isArray(workflows)
      ? workflows.map((workflow) => ({
        id: workflow.id,
        name: workflow.name || workflow.id,
      }))
      : []

    if (!options.some((item) => item.id === 'singularity-studio')) {
      options.unshift({
        id: 'singularity-studio',
        name: '奇点编辑部',
      })
    }

    if (presetWorkflowId && !options.some((item) => item.id === presetWorkflowId)) {
      options.unshift({
        id: presetWorkflowId,
        name: presetWorkflowId,
      })
    }

    return options
  }, [workflows, presetWorkflowId])
  const selectedWorkflowId = form.workflowId || workflowOptions[0]?.id || ''

  if (!token) {
    return <LoginRequiredState title="新建频道并部署" description="这里走的是用户态创建与部署接口，必须先登录后才能提交频道表单。" />
  }

  const handleChange = (key, value) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }))
  }

  const handleSecretChange = (key, value) => {
    setSecretDrafts((current) => ({
      ...current,
      [key]: value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitState({ state: 'idle', message: '' })

    const workflowId = String(selectedWorkflowId || '').trim()
    const name = String(form.name || '').trim()
    const slug = normalizeChannelSlug(form.slug)
    const deploymentMode = form.deploymentMode === 'manual' ? 'manual' : 'auto'
    const missingSecret = deploymentMode === 'auto'
      ? SECRET_FIELD_DEFINITIONS.find((field) => field.required !== false && !String(secretDrafts[field.key] || '').trim())
      : null

    if (!workflowId) {
      setSubmitState({ state: 'error', message: '请填写所属 workflowId。' })
      return
    }
    if (!name) {
      setSubmitState({ state: 'error', message: '请填写频道名称。' })
      return
    }
    if (!slug) {
      setSubmitState({ state: 'error', message: '请填写英文 slug，只能包含字母、数字和连字符。' })
      return
    }
    if (missingSecret) {
      setSubmitState({ state: 'error', message: `请填写${missingSecret.label}。` })
      return
    }

    setSubmitState({ state: 'loading', message: deploymentMode === 'manual' ? '正在提交独立部署审核…' : '正在提交创建审核…' })

    try {
      const releaseName = buildReleaseName(slug)
      const deploymentPayload = deploymentMode === 'manual'
        ? {
          mode: 'manual',
        }
        : {
          mode: 'auto',
          targetKind: 'k8s',
          request: {
            releaseName,
            secretEnv: buildSecretPatch(secretDrafts),
          },
        }
      const result = await requestApi(
        '/v1/channels/deploy',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            channel: {
              workflowId,
              name,
              slug,
              summary: String(form.summary || '').trim() || undefined,
              descriptionPublic: String(form.descriptionPublic || '').trim() || undefined,
              visibility: form.visibility,
              applicationMode: form.applicationMode,
              tags: parseTagInput(form.tags),
            },
            deployment: deploymentPayload,
          }),
        },
        token,
      )

      if (result?.reviewRequest?.id) {
        navigate('/me/channels', {
          state: {
            message: deploymentMode === 'manual'
              ? `频道「${name}」的独立部署申请已提交（${result.reviewRequest.id}）。管理员独立部署并审核通过后，频道会以独立部署方式上线。`
              : `频道「${name}」的创建审核已提交（${result.reviewRequest.id}）。管理员通过后才会真正创建频道并触发首发部署。`,
          },
        })
        return
      }

      if (result?.channel?.id) {
        navigate(`/me/channels/${result.channel.id}`, {
          state: {
            message: `频道「${result?.channel?.name || name}」已创建，并已提交首发部署任务 ${result?.task?.taskId || ''}。`,
          },
        })
        return
      }

      navigate('/me/channels', {
        state: {
          message: `频道「${name}」已提交，等待后端返回最终处理结果。`,
        },
      })
    } catch (error) {
      setSubmitState({ state: 'error', message: error.message || '提交创建审核失败。' })
    }
  }

  return (
    <div className="detail">
      <p className="eyebrow">Workspace</p>
      <h1>新建频道申请</h1>
      <p className="lead">
        当前表单统一走 `POST /v1/channels/deploy`。你可以选择“自动部署”或“独立部署”；普通用户提交后都会先进入管理员审核，再由平台自动部署，或由管理员独立部署并回填频道入口。
      </p>

      <section className="resources resource-panel">
        <div className="section-head section-head-tight">
          <div>
            <h2>频道表单</h2>
            <p className="section-copy">一个 workflow 下可以挂多个频道，所以这里需要显式选择 `workflowId`。频道展示名和内部部署 `releaseName` 分离；自动部署时 `releaseName` 会按 slug 自动生成全局唯一值。</p>
            <p className="section-copy">自动部署会按默认 k8s 配置首发部署；独立部署则由管理员在外部完成部署，再回填频道入口，效果类似现在导入的那几条独立频道。</p>
            {!!workflowsError && <p className="section-copy">工作流目录暂时加载失败，当前先使用默认 workflow 选项。</p>}
          </div>
        </div>

        <form id="create-channel-form" className="editor-grid channel-create-form" onSubmit={handleSubmit}>
          <label className="editor-field">
            <span>workflowId</span>
            <select
              value={selectedWorkflowId}
              onChange={(event) => handleChange('workflowId', event.target.value)}
              disabled={isWorkflowsLoading && workflowOptions.length === 0}
            >
              {!selectedWorkflowId && <option value="">请选择工作流</option>}
              {workflowOptions.map((workflow) => (
                <option key={workflow.id} value={workflow.id}>
                  {workflow.name} ({workflow.id})
                </option>
              ))}
            </select>
          </label>
          <label className="editor-field">
            <span>频道名称</span>
            <input
              type="text"
              value={form.name}
              onChange={(event) => handleChange('name', event.target.value)}
              placeholder="例如 AI 科技"
            />
          </label>
          <label className="editor-field">
            <span>Slug</span>
            <input
              type="text"
              value={form.slug}
              onChange={(event) => handleChange('slug', event.target.value)}
              placeholder="例如 ai-tech"
            />
          </label>
          <label className="editor-field">
            <span>申请模式</span>
            <select value={form.applicationMode} onChange={(event) => handleChange('applicationMode', event.target.value)}>
              <option value="open">开放加入</option>
              <option value="review">需要审核</option>
              <option value="closed">关闭申请</option>
            </select>
          </label>
          <label className="editor-field">
            <span>部署方式</span>
            <select value={form.deploymentMode} onChange={(event) => handleChange('deploymentMode', event.target.value)}>
              <option value="auto">自动部署（平台自动发 k8s 任务）</option>
              <option value="manual">独立部署（独立部署到单独的服务器）</option>
            </select>
          </label>
          <label className="editor-field">
            <span>可见性</span>
            <select value={form.visibility} onChange={(event) => handleChange('visibility', event.target.value)}>
              <option value="public">公开</option>
              <option value="unlisted">不公开</option>
              <option value="private">私有</option>
            </select>
          </label>
          <label className="editor-field editor-field-wide">
            <span>频道简介</span>
            <input
              type="text"
              value={form.summary}
              onChange={(event) => handleChange('summary', event.target.value)}
              placeholder="列表页短简介"
            />
          </label>
          <label className="editor-field editor-field-wide">
            <span>公开说明</span>
            <textarea
              value={form.descriptionPublic}
              onChange={(event) => handleChange('descriptionPublic', event.target.value)}
              placeholder="对外公开的详细描述"
            />
          </label>
          <label className="editor-field editor-field-wide">
            <span>标签（可选）</span>
            <textarea
              value={form.tags}
              onChange={(event) => handleChange('tags', event.target.value)}
              placeholder="用逗号或换行分隔，例如：transport:telegram, team:content"
            />
          </label>
          {form.deploymentMode === 'auto' ? (
            <div className="editor-field editor-field-wide">
              <span>首发部署密钥</span>
              <div className="editor-grid secret-grid">
                {SECRET_FIELD_DEFINITIONS.map((field) => (
                  <label key={field.key} className="editor-field">
                    <span>{field.required === false ? `${field.label}（可选）` : field.label}</span>
                    <input
                      type="password"
                      value={secretDrafts[field.key] || ''}
                      onChange={(event) => handleSecretChange(field.key, event.target.value)}
                      placeholder={field.kind === 'api' ? '请输入 API Key' : '请输入 Telegram Bot Token'}
                      autoComplete="new-password"
                    />
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div className="editor-field editor-field-wide">
              <span>独立部署说明</span>
              <p className="panel-state">独立部署模式下，这里不会收集 k8s 首发部署密钥。管理员审核通过后，会将频道独立部署到单独的服务器，并把最终频道入口回填回来。</p>
            </div>
          )}
        </form>

        <div className="meta-grid create-channel-presets">
          <div className="meta-card">
            <p>部署方式</p>
            <strong>{form.deploymentMode === 'manual' ? '独立部署' : '自动部署'}</strong>
          </div>
          <div className="meta-card">
            <p>目标类型</p>
            <strong>{form.deploymentMode === 'manual' ? '管理员回填频道入口' : 'Kubernetes'}</strong>
          </div>
          <div className="meta-card">
            <p>首发部署</p>
            <strong>{form.deploymentMode === 'manual' ? '审核通过后由管理员独立部署' : '审核通过后提交'}</strong>
          </div>
        </div>

        {submitState.message && (
          <p className={`auth-status ${submitState.state}`}>
            {submitState.message}
          </p>
        )}

        <div className="editor-actions">
          <button form="create-channel-form" type="submit" className="primary" disabled={submitState.state === 'loading'}>
            {submitState.state === 'loading' ? '提交审核中…' : '提交审核'}
          </button>
          <Link className="ghost" to="/me/channels">返回我的频道</Link>
        </div>
      </section>
    </div>
  )
}

const ManagedTaskList = ({ tasks, retryableFreshDeployTaskId = '', onRetryFreshDeploy = null, isRetryFreshDeployDisabled = false }) => {
  if (!tasks.length) {
    return <p className="panel-state">当前还没有部署任务记录。</p>
  }

  return (
    <div className="task-list">
      {tasks.map((task) => (
        <article key={task.id} className="task-card">
          <div className="task-card-head">
            <div>
              <p className="task-title">{formatStatus(task.taskType)}</p>
              <p className="task-meta">{formatStatus(task.status)} · {formatDate(task.createdAt)}</p>
            </div>
            <span className="sub-chip">{formatStatus(task.status)}</span>
          </div>
          <p className="task-meta">任务 ID · {task.id}</p>
          <p className="task-meta">目标资源 · {getDeployTaskResourceLabel(task)}</p>
          {task.startedAt && <p className="task-meta">开始时间 · {formatDate(task.startedAt)}</p>}
          {task.finishedAt && <p className="task-meta">完成时间 · {formatDate(task.finishedAt)}</p>}
          {task.errorMessage && <p className="task-error">{task.errorMessage}</p>}
          {task.id === retryableFreshDeployTaskId && typeof onRetryFreshDeploy === 'function' && (
            <div className="task-card-actions">
              <button type="button" className="ghost" onClick={onRetryFreshDeploy} disabled={isRetryFreshDeployDisabled}>
                重试首发部署
              </button>
            </div>
          )}
        </article>
      ))}
    </div>
  )
}

const MyChannelDetail = ({ channelId }) => {
  const navigate = useNavigate()
  const { session } = useSessionState()
  const token = session.token || ''
  const { channel, isLoading: isChannelLoading, error: channelError, refetch: refetchChannel } = useManagedChannel(channelId, token)
  const { config, isLoading: isConfigLoading, error: configError, refetch: refetchConfig } = useManagedChannelDeployConfig(channelId, token)
  const { tasks, isLoading: isTasksLoading, error: tasksError, refetch: refetchTasks } = useManagedChannelTasks(channelId, token)
  const {
    reviewRequests: joinReviewRequests,
    isLoading: isJoinReviewRequestsLoading,
    error: joinReviewRequestsError,
    refetch: refetchJoinReviewRequests,
  } = useManagedChannelJoinRequests(channelId, token)
  const {
    memberships,
    isLoading: isMembershipsLoading,
    error: membershipsError,
    refetch: refetchMemberships,
  } = useManagedChannelMembers(channelId, token)
  const [isEditingConfig, setIsEditingConfig] = useState(false)
  const [secretDrafts, setSecretDrafts] = useState({})
  const [submitState, setSubmitState] = useState({ state: 'idle', message: '' })
  const [actionState, setActionState] = useState({ state: 'idle', message: '' })
  const [reviewActionState, setReviewActionState] = useState({ state: 'idle', message: '' })
  const [pendingTaskId, setPendingTaskId] = useState('')
  const bootstrapRequest = resolveBootstrapRequest(channel, config, tasks)
  const selectedTargetKind = config?.targetKind || channel?.targetKind || 'k8s'
  const k8sRedeployReleaseName = String(channel?.releaseName || bootstrapRequest.releaseName || '').trim()
  const k8sRedeployNamespace = String(channel?.namespace || bootstrapRequest.namespace || '').trim()
  const supportsK8sRedeploy = selectedTargetKind === 'k8s' && getChannelDeploymentMode(channel) === 'auto' && Boolean(k8sRedeployReleaseName)
  const latestTask = tasks[0] || null
  const activeTask = useMemo(
    () => resolveActiveChannelTask(tasks, channel?.currentTaskId),
    [tasks, channel?.currentTaskId],
  )
  const pendingTask = useMemo(() => {
    if (!pendingTaskId) {
      return null
    }
    return tasks.find((task) => task?.id === pendingTaskId) || { id: pendingTaskId, status: 'accepted' }
  }, [tasks, pendingTaskId])
  const hasLifecycleTransition = ['provisioning', 'deleting'].includes(String(channel?.lifecycleStatus || '').trim())
  const blockingTask = useMemo(() => {
    if (pendingTaskId && (!pendingTask || isActiveDeployTaskStatus(pendingTask.status))) {
      return pendingTask
    }
    return activeTask
  }, [activeTask, pendingTask, pendingTaskId])
  const hasActiveOperation = Boolean(blockingTask) || hasLifecycleTransition

  useEffect(() => {
    if (!pendingTaskId) {
      return
    }
    const matchedTask = tasks.find((task) => task?.id === pendingTaskId)
    if (matchedTask && !isActiveDeployTaskStatus(matchedTask.status)) {
      setPendingTaskId('')
    }
  }, [pendingTaskId, tasks])

  useEffect(() => {
    if (!token || !hasActiveOperation) {
      return
    }
    const timer = window.setInterval(() => {
      void refetchChannel()
      void refetchConfig()
      void refetchTasks()
    }, 5000)
    return () => window.clearInterval(timer)
  }, [token, hasActiveOperation, refetchChannel, refetchConfig, refetchTasks])

  useEffect(() => {
    if (!hasActiveOperation || !isEditingConfig) {
      return
    }
    setIsEditingConfig(false)
  }, [hasActiveOperation, isEditingConfig])

  if (!token) {
    return <LoginRequiredState title="频道维护" description="维护页已经加上了，但这里走的是 owner 权限接口，必须先登录。" />
  }

  if (isChannelLoading) {
    return (
      <div className="detail">
        <p className="eyebrow">Manage</p>
        <h1>加载维护页中</h1>
        <p className="lead">正在读取用户频道详情、部署配置和最近任务。</p>
      </div>
    )
  }

  if (channelError || !channel) {
    return (
      <div className="detail">
        <p className="eyebrow">Manage</p>
        <h1>频道维护页加载失败</h1>
        <p className="lead">{channelError || '未找到该频道，或当前账号没有访问权限。'}</p>
        <Link className="primary" to="/me/channels">返回我的频道</Link>
      </div>
    )
  }

  const configSummary = config ? [
    { label: '部署目标', value: formatStatus(config.targetKind) },
    { label: '最近应用任务', value: config.lastAppliedTaskId || '未记录' },
    { label: '包含密钥环境变量', value: config.hasSecretEnv ? '是' : '否' },
    { label: '配置更新时间', value: formatDate(config.updatedAt) },
  ] : []

  const managedMetadata = [
    { label: '频道 ID', value: channel.id },
    { label: 'Slug', value: channel.slug },
    { label: 'Owner', value: channel.owner?.name || '未知' },
    { label: '命名空间', value: channel.namespace || '未绑定' },
    { label: 'Release Name', value: channel.releaseName || '未绑定' },
    { label: 'Resource Key', value: channel.resourceKey || '未绑定' },
    { label: '当前任务', value: channel.currentTaskId || '无' },
    { label: 'TG 群 ID', value: getChannelTgGroupId(channel, { allowRuntimeFallback: true }) || '未探测到' },
  ]
  const canBootstrapConfig = Object.keys(bootstrapRequest).length > 0
  const secretFieldStates = buildSecretFieldStates(config?.secretEnvKeys || [])
  const activeOperationTaskId = String(blockingTask?.id || channel?.currentTaskId || '').trim()
  const activeOperationStatus = blockingTask?.status || (hasLifecycleTransition ? channel?.lifecycleStatus : '')
  const activeOperationMessage = hasActiveOperation
    ? `当前任务 ${activeOperationTaskId || '处理中'} 处于${formatStatus(activeOperationStatus)}状态，完成前暂时不能重复操作。`
    : ''

  const handleBeginEdit = () => {
    if (hasActiveOperation) {
      setSubmitState({ state: 'error', message: activeOperationMessage })
      return
    }
    setSecretDrafts({})
    setSubmitState({ state: 'idle', message: '' })
    setActionState({ state: 'idle', message: '' })
    setIsEditingConfig(true)
  }

  const handleCancelEdit = () => {
    setIsEditingConfig(false)
    setSecretDrafts({})
  }

  const handleSecretDraftChange = (key, value) => {
    setSecretDrafts((current) => ({
      ...current,
      [key]: value,
    }))
  }

  const handleSubmitPatch = async () => {
    if (hasActiveOperation) {
      setSubmitState({ state: 'error', message: activeOperationMessage })
      return
    }

    setSubmitState({ state: 'loading', message: '正在保存配置并发布…' })

    try {
      const secretPatch = buildSecretPatch(secretDrafts)
      const hasSecretPatch = Object.keys(secretPatch).length > 0

      if (!hasSecretPatch) {
        throw new Error('请至少填写一个 API Key 或 Bot Token。')
      }

      let requestPayload = { secretEnv: secretPatch }

      if (!config) {
        if (!canBootstrapConfig) {
          throw new Error('当前无法从实例推导出基础配置，请补充部署配置后再保存。')
        }
        requestPayload = mergeRequestPatch(bootstrapRequest, requestPayload)
      }

      const result = await requestApi(
        `/v1/channels/${encodeURIComponent(channel.id)}/deployment-config`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            targetKind: selectedTargetKind,
            request: requestPayload,
          }),
        },
        token,
      )

      const nextTaskId = String(result?.task?.taskId || result?.task?.id || '').trim()
      if (nextTaskId) {
        setPendingTaskId(nextTaskId)
      }
      await Promise.all([
        refetchChannel(),
        refetchConfig(),
        refetchTasks(),
      ])
      setSubmitState({ state: 'success', message: buildTaskSuccessMessage(result?.task) })
      setIsEditingConfig(false)
    } catch (error) {
      setSubmitState({ state: 'error', message: error.message || '提交失败。' })
    }
  }

  const handleRedeploy = async () => {
    if (hasActiveOperation) {
      setActionState({ state: 'error', message: activeOperationMessage })
      return
    }

    if (!supportsK8sRedeploy) {
      setActionState({ state: 'error', message: '当前频道没有可用于重新部署的 releaseName。' })
      return
    }

    if (!config) {
      setActionState({ state: 'error', message: '当前没有可复用的持久化配置，先补建配置后才能重新部署。' })
      return
    }

    setActionState({ state: 'loading', message: '正在提交重新部署任务…' })

    try {
      const result = await requestApi(
        '/v1/deepflow/k8s/redeploy',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              channelId: channel.id,
              releaseName: k8sRedeployReleaseName,
              namespace: k8sRedeployNamespace || undefined,
              skipPersistChannelConfig: true,
            }),
          },
          token,
        )

      const nextTaskId = String(result?.taskId || result?.task?.taskId || result?.task?.id || '').trim()
      if (nextTaskId) {
        setPendingTaskId(nextTaskId)
      }
      await Promise.all([
        refetchChannel(),
        refetchConfig(),
        refetchTasks(),
      ])
      setActionState({ state: 'success', message: buildTaskSuccessMessage(result) })
    } catch (error) {
      setActionState({ state: 'error', message: error.message || '重新部署失败。' })
    }
  }

  const handleDeepRedeploy = async () => {
    if (hasActiveOperation) {
      setActionState({ state: 'error', message: activeOperationMessage })
      return
    }

    if (!supportsK8sRedeploy) {
      setActionState({ state: 'error', message: '当前频道没有可用于深度重新部署的 releaseName。' })
      return
    }

    if (!config) {
      setActionState({ state: 'error', message: '当前没有可复用的持久化配置，先补建配置后才能深度重新部署。' })
      return
    }

    setActionState({ state: 'loading', message: '正在提交深度重新部署任务…' })

    try {
      const result = await requestApi(
        '/v1/deepflow/k8s/deep-redeploy',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              channelId: channel.id,
              releaseName: k8sRedeployReleaseName,
              namespace: k8sRedeployNamespace || undefined,
              skipPersistChannelConfig: true,
            }),
          },
          token,
        )

      const nextTaskId = String(result?.taskId || result?.task?.taskId || result?.task?.id || '').trim()
      if (nextTaskId) {
        setPendingTaskId(nextTaskId)
      }
      await Promise.all([
        refetchChannel(),
        refetchConfig(),
        refetchTasks(),
      ])
      setActionState({ state: 'success', message: buildTaskSuccessMessage(result) })
    } catch (error) {
      setActionState({ state: 'error', message: error.message || '深度重新部署失败。' })
    }
  }

  const handleDestroyChannel = async () => {
    if (hasActiveOperation) {
      setActionState({ state: 'error', message: activeOperationMessage })
      return
    }

    const confirmed = window.confirm(`确认删除频道「${channel.name}」？这个操作会删除实例并归档频道，审核和历史记录会保留。`)
    if (!confirmed) {
      return
    }

    setActionState({ state: 'loading', message: '正在删除频道…' })

    try {
      await requestApi(
        `/v1/channels/${encodeURIComponent(channel.id)}/destroy`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        },
        token,
      )

      navigate('/me/channels', {
        state: {
          message: `频道「${channel.name}」已删除。`,
        },
      })
    } catch (error) {
      setActionState({ state: 'error', message: error.message || '删除频道失败。' })
    }
  }

  const handleReviewDecision = async (reviewRequestId, decision) => {
    setReviewActionState({
      state: 'loading',
      message: decision === 'approve' ? '正在通过加入申请…' : '正在驳回加入申请…',
    })

    try {
      await requestApi(
        `/v1/review-requests/${encodeURIComponent(reviewRequestId)}/${decision}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        },
        token,
      )
      await Promise.all([
        refetchJoinReviewRequests(),
        refetchMemberships(),
        refetchChannel(),
      ])
      setReviewActionState({
        state: 'success',
        message: decision === 'approve' ? `加入申请 ${reviewRequestId} 已通过。` : `加入申请 ${reviewRequestId} 已驳回。`,
      })
    } catch (error) {
      setReviewActionState({ state: 'error', message: error.message || '处理加入审核失败。' })
    }
  }

  const canRedeploy = supportsK8sRedeploy && Boolean(config)
  const retryableFreshDeployTaskId = latestTask?.taskType === 'k8s_deploy'
    && latestTask?.status === 'failed'
    && selectedTargetKind === 'k8s'
    && getChannelDeploymentMode(channel) === 'auto'
    && Boolean(config)
    ? latestTask.id
    : ''
  const isActionPending = actionState.state === 'loading'
  const isOperationLocked = isActionPending || hasActiveOperation

  const handleRetryFreshDeploy = async () => {
    if (hasActiveOperation) {
      setActionState({ state: 'error', message: activeOperationMessage })
      return
    }

    if (!config) {
      setActionState({ state: 'error', message: '当前没有可复用的持久化部署配置，先补建配置后才能重试首发部署。' })
      return
    }

    setActionState({ state: 'loading', message: '正在提交首发部署重试任务…' })

    try {
      const result = await requestApi(
        '/v1/deepflow/k8s/deploy',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            channelId: channel.id,
            releaseName: k8sRedeployReleaseName || undefined,
            namespace: k8sRedeployNamespace || undefined,
            skipPersistChannelConfig: true,
          }),
        },
        token,
      )
      const nextTaskId = String(result?.taskId || result?.task?.taskId || result?.task?.id || '').trim()
      if (nextTaskId) {
        setPendingTaskId(nextTaskId)
      }
      await Promise.all([
        refetchChannel(),
        refetchConfig(),
        refetchTasks(),
      ])
      setActionState({ state: 'success', message: buildTaskSuccessMessage(result) })
    } catch (error) {
      setActionState({ state: 'error', message: error.message || '重试首发部署失败。' })
    }
  }

  return (
    <div className="detail">
      <p className="eyebrow">Manage</p>
      <h1>{channel.name}</h1>
      <p className="lead">{channel.descriptionPublic || summarizeChannel(channel)}</p>

      <div className="stats">
        <div>
          <p className="stat-value">{formatStatus(channel.lifecycleStatus)}</p>
          <p className="stat-label">运行状态</p>
        </div>
        <div>
          <p className="stat-value">{formatStatus(channel.healthStatus)}</p>
          <p className="stat-label">健康状态</p>
        </div>
        <div>
          <p className="stat-value">{formatStatus(getChannelDeploymentMode(channel))}</p>
          <p className="stat-label">部署方式</p>
        </div>
        <div>
          <p className="stat-value">{formatStatus(channel.targetKind)}</p>
          <p className="stat-label">部署目标</p>
        </div>
      </div>

      <section className="resources">
        <div className="section-head section-head-tight">
          <div>
            <h2>维护入口</h2>
            <p className="section-copy">这里走的是 owner 视角接口：频道详情、部署配置、任务记录都来自登录态接口。</p>
          </div>
          <div className="inline-actions">
            <Link to={`/channels/${resolveChannelRouteId(channel)}`}>公开详情</Link>
            {getChannelPrimaryActionUrl(channel, { allowRuntimeFallback: true }) && (
              <a href={getChannelPrimaryActionUrl(channel, { allowRuntimeFallback: true })} target="_blank" rel="noreferrer">
                {getChannelLinkLabel(channel, { allowRuntimeFallback: true })}
              </a>
            )}
          </div>
        </div>
        <div className="resource-stack">
          <p className="guide-title">运维动作</p>
          <div className="action-fields">
            <div className="action-field">
              <div>
                <p className="action-label">重新部署</p>
                <p className="action-copy">
                  按当前配置重新部署一次频道，让刚修改的配置重新生效。
                </p>
              </div>
              <button type="button" className="ghost" onClick={handleRedeploy} disabled={!canRedeploy || isOperationLocked}>
                重新部署
              </button>
            </div>
            {supportsK8sRedeploy && (
              <div className="action-field">
                <div>
                  <p className="action-label">深度重新部署</p>
                  <p className="action-copy">
                    拉取最新代码，并把频道完整重启一次。适合升级代码或排查异常。
                  </p>
                </div>
                <button type="button" className="ghost" onClick={handleDeepRedeploy} disabled={!canRedeploy || isOperationLocked}>
                  深度重新部署
                </button>
              </div>
            )}
            <div className="action-field action-field-danger">
              <div>
                <p className="action-label">删除频道</p>
                <p className="action-copy">删除实例并归档频道。部署配置、审核记录和任务历史会保留。</p>
              </div>
              <button type="button" className="ghost danger" onClick={handleDestroyChannel} disabled={isOperationLocked}>
                删除频道
              </button>
            </div>
          </div>
          {!supportsK8sRedeploy && <p className="section-copy">这条频道还没有可复用的 releaseName，暂时不能直接重新部署。</p>}
          {supportsK8sRedeploy && !config && <p className="section-copy">这条频道还没有持久化部署配置，k8s 重部署暂时缺少可复用的密钥配置。</p>}
          {!!activeOperationMessage && <p className="section-copy">{activeOperationMessage}</p>}
          {!!actionState.message && !isEditingConfig && (
            <p className={`auth-status ${actionState.state === 'error' ? 'error' : actionState.state === 'success' ? 'success' : 'loading'}`}>
              {actionState.message}
            </p>
          )}
        </div>
      </section>

      <section className="resources resource-panel">
        <h2>频道元数据</h2>
        <div className="meta-grid">
          {managedMetadata.map((item) => (
            <div key={item.label} className="meta-card">
              <p>{item.label}</p>
              <strong>{formatValue(item.value)}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="resources resource-panel">
        <div className="section-head section-head-tight">
          <div>
            <h2>加入审核</h2>
            <p className="section-copy">如果这个频道选择了“需要审核”，新的加入请求会在这里由频道 owner 处理。</p>
          </div>
          <div className="inline-actions">
            <Link to="/me/review-requests?tab=assigned">进入审核列表</Link>
          </div>
        </div>
        {reviewActionState.message && <p className={`auth-status ${reviewActionState.state}`}>{reviewActionState.message}</p>}
        {isJoinReviewRequestsLoading && <p className="panel-state">正在加载待审核加入请求…</p>}
        {!isJoinReviewRequestsLoading && joinReviewRequestsError && <p className="panel-state error">{joinReviewRequestsError}</p>}
        {!isJoinReviewRequestsLoading && !joinReviewRequestsError && (
          <ReviewRequestList
            reviewRequests={joinReviewRequests}
            emptyText="当前没有待审核的加入请求。"
            detailBasePath="/me/review-requests"
            actionSlot={(reviewRequest) => (
              <div className="task-card-actions">
                <button type="button" className="ghost" onClick={() => handleReviewDecision(reviewRequest.id, 'approve')}>
                  通过
                </button>
                <button type="button" className="ghost danger" onClick={() => handleReviewDecision(reviewRequest.id, 'reject')}>
                  驳回
                </button>
              </div>
            )}
          />
        )}
      </section>

      <section className="resources resource-panel">
        <div className="section-head section-head-tight">
          <div>
            <h2>频道成员</h2>
            <p className="section-copy">这里展示已经通过审核、可以看到群入口的用户。</p>
          </div>
        </div>
        {isMembershipsLoading && <p className="panel-state">正在加载频道成员…</p>}
        {!isMembershipsLoading && membershipsError && <p className="panel-state error">{membershipsError}</p>}
        {!isMembershipsLoading && !membershipsError && memberships.length === 0 && <p className="panel-state">当前还没有已批准成员。</p>}
        {!isMembershipsLoading && !membershipsError && memberships.length > 0 && (
          <div className="meta-grid">
            {memberships.map((membership) => (
              <div key={membership.id} className="meta-card">
                <p>{membership.userName}</p>
                <strong>{membership.userId}</strong>
                <p className="meta-footnote">批准时间 · {formatDate(membership.approvedAt)}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="resources resource-panel">
        <div className="section-head section-head-tight">
          <div>
            <h2>当前部署配置</h2>
            <p className="section-copy">当前用户侧只开放 API Key 和 Bot Token 的维护，不开放镜像、域名、PVC 这类部署参数。</p>
          </div>
        </div>
        {isConfigLoading && <p className="panel-state">正在加载部署配置…</p>}
        {!isConfigLoading && configError && <p className="panel-state error">{configError}</p>}
        {!isConfigLoading && !configError && !config && (
          <p className="panel-state">
            当前还没有持久化的部署配置。
            {canBootstrapConfig ? ' 首次保存时会基于最近一次部署请求补建配置记录。' : ' 当前也还没有可用于补建的基础请求快照。'}
          </p>
        )}

        {!isConfigLoading && !configError && config && (
          <>
            <div className="meta-grid">
              {configSummary.map((item) => (
                <div key={item.label} className="meta-card">
                  <p>{item.label}</p>
                  <strong>{formatValue(item.value)}</strong>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="resource-stack resource-subpanel">
          <div className="section-head section-head-tight">
            <div>
              <p className="guide-title">密钥配置状态</p>
              <p className="section-copy">这里只维护 API Key 和 Bot Token。</p>
            </div>
            {!isConfigLoading && !configError && !hasActiveOperation && (
              <div className="inline-actions">
                <button
                  type="button"
                  className="ghost"
                  onClick={handleBeginEdit}
                  disabled={!config && isTasksLoading}
                >
                  {config ? '编辑密钥' : '补建配置并编辑密钥'}
                </button>
              </div>
            )}
          </div>
          <div className="meta-grid">
            {secretFieldStates.map((field) => (
              <div key={field.key} className="meta-card">
                <p>{field.label}</p>
                <strong>{field.configured ? '已配置' : '未配置'}</strong>
              </div>
            ))}
          </div>
        </div>

        {submitState.message && !isEditingConfig && (
          <p className={`auth-status ${submitState.state}`}>
            {submitState.message}
          </p>
        )}

        {!isConfigLoading && !configError && hasActiveOperation && (
          <p className="section-copy">{activeOperationMessage}</p>
        )}

        {isEditingConfig && !hasActiveOperation && (
          <div className="editor-panel">
            <div className="section-head section-head-tight">
              <div>
                <h2>编辑密钥</h2>
                <p className="section-copy">保存后会调用更新配置接口，并立即触发一次新的发布任务。</p>
              </div>
              <div className="editor-toolbar">
                <button type="button" className="ghost" onClick={handleCancelEdit}>
                  取消编辑
                </button>
                <button type="button" className="ghost" onClick={handleBeginEdit}>
                  重置为当前配置
                </button>
              </div>
            </div>

            <p className="panel-state">
              `secretEnv` 的真实值不会从后端返回。下面开放给用户直接配置 `API Key` 和 `Bot Token`，
              留空表示这次不修改该密钥。
            </p>

            <div className="secret-grid">
              {secretFieldStates.map((field) => (
                <label key={field.key} className="editor-field">
                  <span>{field.label}</span>
                  <input
                    type="password"
                    value={secretDrafts[field.key] || ''}
                    onChange={(event) => handleSecretDraftChange(field.key, event.target.value)}
                    placeholder={field.configured ? '已配置，留空表示不修改' : '留空表示暂不设置'}
                    autoComplete="off"
                  />
                </label>
              ))}
            </div>

            {submitState.message && (
              <p className={`auth-status ${submitState.state}`}>
                {submitState.message}
              </p>
            )}

            <div className="editor-actions">
              <button type="button" className="primary" onClick={handleSubmitPatch} disabled={submitState.state === 'loading' || hasActiveOperation}>
                {submitState.state === 'loading' ? '保存中…' : '保存配置并发布'}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="resources">
        <h2>最近任务</h2>
        {isTasksLoading && <p className="panel-state">正在加载最近任务…</p>}
        {!isTasksLoading && tasksError && <p className="panel-state error">{tasksError}</p>}
        {!isTasksLoading && !tasksError && (
          <ManagedTaskList
            tasks={tasks}
            retryableFreshDeployTaskId={retryableFreshDeployTaskId}
            onRetryFreshDeploy={handleRetryFreshDeploy}
            isRetryFreshDeployDisabled={isOperationLocked}
          />
        )}
      </section>

      <Link className="primary" to="/me/channels">返回我的频道</Link>
    </div>
  )
}

const ManagedChannelDetailRoute = () => {
  const { channelId } = useParams()
  return <MyChannelDetail key={channelId || 'unknown-channel'} channelId={channelId || ''} />
}

const AdminLogin = () => {
  const navigate = useNavigate()
  const { adminSession, setAdminSession } = useSessionState()
  const [form, setForm] = useState({ username: '', password: '' })
  const [status, setStatus] = useState({ state: 'idle', message: '' })

  useEffect(() => {
    if (adminSession.token) {
      navigate('/admin/review-requests', { replace: true })
    }
  }, [adminSession.token, navigate])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setStatus({ state: 'loading', message: '正在登录管理端…' })

    try {
      const result = await requestApi('/v1/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: String(form.username || '').trim(),
          password: String(form.password || ''),
        }),
      })

      setAdminSession({
        token: result?.accessToken || '',
        adminId: result?.admin?.id || '',
        username: result?.admin?.username || '',
        role: result?.admin?.role || '',
        expiresAt: result?.expiresAt || '',
      })
      navigate('/admin/review-requests', { replace: true })
    } catch (error) {
      setStatus({ state: 'error', message: error.message || '管理员登录失败。' })
    }
  }

  return (
    <div className="detail admin-auth">
      <p className="eyebrow">Admin</p>
      <h1>管理员登录</h1>
      <p className="lead">这里走账号密码登录，用于审核“创建频道并部署”这类管理员审批请求。</p>

      <section className="resources resource-panel">
        <form id="admin-login-form" className="editor-grid channel-create-form" onSubmit={handleSubmit}>
          <label className="editor-field">
            <span>用户名</span>
            <input
              type="text"
              value={form.username}
              onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
              placeholder="admin username"
              autoComplete="username"
            />
          </label>
          <label className="editor-field">
            <span>密码</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              placeholder="admin password"
              autoComplete="current-password"
            />
          </label>
        </form>

        {status.message && <p className={`auth-status ${status.state}`}>{status.message}</p>}

        <div className="editor-actions">
          <button type="submit" form="admin-login-form" className="primary" disabled={status.state === 'loading'}>
            {status.state === 'loading' ? '登录中…' : '登录管理端'}
          </button>
          <Link className="ghost" to="/">返回工作流</Link>
        </div>
      </section>
    </div>
  )
}

const AdminNavTabs = () => (
  <div className="admin-tab-row">
    <NavLink to="/admin/review-requests" className={({ isActive }) => `admin-tab ${isActive ? 'active' : ''}`}>
      创建审核
    </NavLink>
    <NavLink to="/admin/queue-overview" className={({ isActive }) => `admin-tab ${isActive ? 'active' : ''}`}>
      队列纵览
    </NavLink>
  </div>
)

const AdminQueueOverviewPanel = ({ token }) => {
  const {
    overview,
    isLoading,
    error,
    refetch,
  } = useAdminQueueOverview(token)

  const summary = overview?.summary || null
  const queues = Array.isArray(overview?.queues) ? overview.queues : []
  const statusTotals = summary?.statusTotals || {}

  return (
    <section className="resources resource-panel">
      <div className="section-head section-head-tight">
        <div>
          <h2>任务队列纵览</h2>
          <p className="section-copy">这里同时看 Redis 队列积压和 worker 最近 1 小时 / 24 小时的消费情况。</p>
        </div>
        <div className="inline-actions">
          {overview?.generatedAt && <span className="count">刷新于 {formatDate(overview.generatedAt)}</span>}
          <button type="button" onClick={() => refetch()}>
            刷新概览
          </button>
        </div>
      </div>

      {isLoading && <p className="panel-state">正在加载队列纵览…</p>}
      {!isLoading && error && <p className="panel-state error">{error}</p>}
      {!isLoading && !error && !overview && <p className="panel-state">当前还没有可展示的队列数据。</p>}
      {!isLoading && !error && overview && (
        <>
          <div className="stats queue-overview-summary">
            <div>
              <p className="stat-value">{summary?.backlogTotal ?? 0}</p>
              <p className="stat-label">Redis 积压（ready + delayed）</p>
            </div>
            <div>
              <p className="stat-value">{summary?.reservedTotal ?? 0}</p>
              <p className="stat-label">Redis 保留中</p>
            </div>
            <div>
              <p className="stat-value">{summary?.runningTaskTotal ?? 0}</p>
              <p className="stat-label">数据库运行中</p>
            </div>
            <div>
              <p className="stat-value">{summary?.processedAttemptsLastHour ?? 0}</p>
              <p className="stat-label">近 1 小时已消费 attempt</p>
            </div>
            <div>
              <p className="stat-value">{summary?.processedAttemptsLast24Hours ?? 0}</p>
              <p className="stat-label">近 24 小时已消费 attempt</p>
            </div>
            <div>
              <p className="stat-value">{summary?.retryWaitingTaskTotal ?? 0}</p>
              <p className="stat-label">任务表等待重试</p>
            </div>
          </div>

          <div className="review-status-row queue-overview-status-row">
            <span className={`review-status-chip ${getReviewStatusTone('accepted')}`}>accepted {statusTotals.accepted || 0}</span>
            <span className={`review-status-chip ${getReviewStatusTone('queued')}`}>queued {statusTotals.queued || 0}</span>
            <span className={`review-status-chip ${getReviewStatusTone('retry_waiting')}`}>retry_waiting {statusTotals.retryWaiting || 0}</span>
            <span className={`review-status-chip ${getReviewStatusTone('running')}`}>running {statusTotals.running || 0}</span>
            <span className={`review-status-chip ${getReviewStatusTone('cancel_requested')}`}>cancel_requested {statusTotals.cancelRequested || 0}</span>
            <span className={`review-status-chip ${getReviewStatusTone('succeeded')}`}>succeeded {statusTotals.succeeded || 0}</span>
            <span className={`review-status-chip ${getReviewStatusTone('failed')}`}>failed {statusTotals.failed || 0}</span>
            <span className={`review-status-chip ${getReviewStatusTone('cancelled')}`}>cancelled {statusTotals.cancelled || 0}</span>
          </div>

          <div className="queue-overview-grid">
            {queues.map((queue) => (
              <article className="queue-overview-card" key={queue.queueName}>
                <div className="task-card-head">
                  <div>
                    <p className="task-title">{queue.label}</p>
                    <p className="task-meta queue-overview-code">{queue.queueName}</p>
                  </div>
                  <div className="review-status-row">
                    <span className={`review-status-chip ${queue.paused ? 'muted' : 'success'}`}>
                      {queue.paused ? 'paused' : 'consuming'}
                    </span>
                  </div>
                </div>

                <div className="meta-grid queue-overview-metrics">
                  <div className="meta-card">
                    <p>ready</p>
                    <strong>{queue.redis.ready}</strong>
                  </div>
                  <div className="meta-card">
                    <p>delayed</p>
                    <strong>{queue.redis.delayed}</strong>
                  </div>
                  <div className="meta-card">
                    <p>reserved</p>
                    <strong>{queue.redis.reserved}</strong>
                  </div>
                  <div className="meta-card">
                    <p>active tasks</p>
                    <strong>{queue.tasks.activeTotal}</strong>
                  </div>
                  <div className="meta-card">
                    <p>近 1h 已消费</p>
                    <strong>{queue.attempts.lastHour.processedTotal}</strong>
                  </div>
                  <div className="meta-card">
                    <p>近 24h 平均耗时</p>
                    <strong>{formatDurationMs(queue.attempts.avgDurationMsLast24Hours)}</strong>
                  </div>
                </div>

                <div className="queue-breakdown-grid">
                  <div className="queue-breakdown-block">
                    <p className="queue-breakdown-title">任务主状态</p>
                    <dl className="queue-breakdown-list">
                      <div><dt>accepted</dt><dd>{queue.tasks.accepted}</dd></div>
                      <div><dt>queued</dt><dd>{queue.tasks.queued}</dd></div>
                      <div><dt>retry_waiting</dt><dd>{queue.tasks.retryWaiting}</dd></div>
                      <div><dt>running</dt><dd>{queue.tasks.running}</dd></div>
                      <div><dt>cancel_requested</dt><dd>{queue.tasks.cancelRequested}</dd></div>
                    </dl>
                  </div>

                  <div className="queue-breakdown-block">
                    <p className="queue-breakdown-title">近 24 小时消费</p>
                    <dl className="queue-breakdown-list">
                      <div><dt>succeeded</dt><dd>{queue.attempts.last24Hours.succeeded}</dd></div>
                      <div><dt>failed</dt><dd>{queue.attempts.last24Hours.failed}</dd></div>
                      <div><dt>released</dt><dd>{queue.attempts.last24Hours.released}</dd></div>
                      <div><dt>timed_out</dt><dd>{queue.attempts.last24Hours.timedOut}</dd></div>
                      <div><dt>cancelled</dt><dd>{queue.attempts.last24Hours.cancelled}</dd></div>
                    </dl>
                  </div>
                </div>

                <p className="meta-footnote">
                  最近完成：{formatDate(queue.attempts.lastFinishedAt)} · task types：{Array.isArray(queue.taskTypes) ? queue.taskTypes.join(', ') : '未记录'}
                </p>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

const AdminReviewRequests = () => {
  const { adminSession } = useSessionState()
  const token = adminSession.token || ''
  const [statusFilter, setStatusFilter] = useState('pending')
  const [actionState, setActionState] = useState({ state: 'idle', message: '' })
  const {
    reviewRequests,
    isLoading,
    error,
    refetch,
  } = useAdminReviewRequests(token, { requestType: 'channel_create', status: statusFilter })

  if (!token) {
    return (
      <LoginRequiredState
        title="管理员审核后台"
        description="请先用管理员账号密码登录，然后再进入审核后台。"
      />
    )
  }

  const handleDecision = async (reviewRequestId, decision) => {
    setActionState({
      state: 'loading',
      message: decision === 'approve' ? '正在通过创建审核…' : '正在驳回创建审核…',
    })
    try {
      await requestApi(
        `/v1/review-requests/${encodeURIComponent(reviewRequestId)}/${decision}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        },
        token,
      )
      await refetch()
      setActionState({
        state: 'success',
        message: decision === 'approve' ? `创建审核 ${reviewRequestId} 已通过。` : `创建审核 ${reviewRequestId} 已驳回。`,
      })
    } catch (requestError) {
      setActionState({ state: 'error', message: requestError.message || '处理创建审核失败。' })
    }
  }

  return (
    <div className="detail">
      <p className="eyebrow">Admin</p>
      <h1>管理员审核后台</h1>
      <p className="lead">这里集中处理“创建频道并部署”的管理员审核。通过后，系统才会真正创建频道并发起首发部署。</p>

      <AdminNavTabs />

      <section className="resources resource-panel">
        <div className="section-head section-head-tight">
          <div>
            <h2>创建审核队列</h2>
            <p className="section-copy">当前只展示 `channel_create` 审核请求。</p>
          </div>
          <div className="inline-actions">
            <button type="button" className={statusFilter === 'pending' ? 'active-filter' : ''} onClick={() => setStatusFilter('pending')}>
              待审核
            </button>
            <button type="button" className={statusFilter === '' ? 'active-filter' : ''} onClick={() => setStatusFilter('')}>
              全部
            </button>
          </div>
        </div>

        {actionState.message && <p className={`auth-status ${actionState.state}`}>{actionState.message}</p>}
        {isLoading && <p className="panel-state">正在加载管理员审核请求…</p>}
        {!isLoading && error && <p className="panel-state error">{error}</p>}
        {!isLoading && !error && (
          <ReviewRequestList
            reviewRequests={reviewRequests}
            emptyText="当前没有待处理的创建审核请求。"
            detailBasePath="/admin/review-requests"
            actionSlot={(reviewRequest) => {
              const channelPayload = reviewRequest.requestPayload?.channel || {}
              const deploymentPayload = reviewRequest.requestPayload?.deployment || {}
              const deploymentRequest = deploymentPayload?.request || {}
              const deploymentMode = getReviewRequestDeploymentMode(reviewRequest)
              return (
                <>
                  <div className="meta-grid compact-meta-grid">
                    <div className="meta-card">
                      <p>频道名</p>
                      <strong>{channelPayload.name || '未配置'}</strong>
                    </div>
                    <div className="meta-card">
                      <p>Slug</p>
                      <strong>{channelPayload.slug || reviewRequest.subjectKey || '未配置'}</strong>
                    </div>
                    <div className="meta-card">
                      <p>Workflow</p>
                      <strong>{reviewRequest.workflowId || '未配置'}</strong>
                    </div>
                    <div className="meta-card">
                      <p>可见性 / 加入策略</p>
                      <strong>{formatStatus(channelPayload.visibility)} / {formatStatus(channelPayload.applicationMode)}</strong>
                    </div>
                    <div className="meta-card">
                      <p>部署方式 / Release</p>
                      <strong>{formatStatus(deploymentMode)} / {deploymentMode === 'manual' ? '管理员回填' : (deploymentRequest.releaseName || '未配置')}</strong>
                    </div>
                    <div className="meta-card">
                      <p>密钥字段</p>
                      <strong>{deploymentMode === 'manual' ? '不需要' : (Array.isArray(reviewRequest.secretEnvKeys) && reviewRequest.secretEnvKeys.length ? reviewRequest.secretEnvKeys.join(', ') : '无')}</strong>
                    </div>
                  </div>
                  {reviewRequest.status === 'pending' && (
                    <div className="task-card-actions">
                      {deploymentMode === 'auto' ? (
                        <button type="button" className="ghost" onClick={() => handleDecision(reviewRequest.id, 'approve')}>
                          通过并创建部署
                        </button>
                      ) : (
                        <Link to={`/admin/review-requests/${reviewRequest.id}`} className="ghost">
                          去详情页回填入口
                        </Link>
                      )}
                      <button type="button" className="ghost danger" onClick={() => handleDecision(reviewRequest.id, 'reject')}>
                        驳回
                      </button>
                    </div>
                  )}
                </>
              )
            }}
          />
        )}
      </section>
    </div>
  )
}

const AdminQueueOverviewPage = () => {
  const { adminSession } = useSessionState()
  const token = adminSession.token || ''

  if (!token) {
    return (
      <LoginRequiredState
        title="管理员队列纵览"
        description="请先用管理员账号密码登录，然后再查看队列概览。"
      />
    )
  }

  return (
    <div className="detail">
      <p className="eyebrow">Admin</p>
      <h1>管理员队列纵览</h1>
      <p className="lead">这里单独查看部署任务的积压、重试、消费效率和最近 24 小时的执行情况。</p>
      <AdminNavTabs />
      <AdminQueueOverviewPanel token={token} />
    </div>
  )
}

const AdminReviewRequestDetail = () => {
  const { reviewRequestId } = useParams()
  const { adminSession } = useSessionState()
  const token = adminSession.token || ''
  const {
    reviewRequest,
    events,
    isLoading,
    error,
    refetch,
  } = useReviewRequestDetail(reviewRequestId, token)
  const subjectRouteId = reviewRequest?.subjectKey || reviewRequest?.subjectId || ''
  const { channel: subjectChannel } = usePublicChannel(subjectRouteId, token)
  const [actionState, setActionState] = useState({ state: 'idle', message: '' })
  const [manualApprovalDraft, setManualApprovalDraft] = useState({
    publicUrl: '',
    tgGroupId: '',
  })
  const deploymentMode = getReviewRequestDeploymentMode(reviewRequest)

  const expectedReviewerLabel = reviewRequest?.reviewer?.name
    || (reviewRequest?.reviewerScope === 'admin'
      ? '管理员审核'
      : reviewRequest?.reviewerScope === 'channel_owner'
        ? (String(subjectChannel?.owner?.name || '').trim() ? `${String(subjectChannel?.owner?.name || '').trim()}（频道 owner）` : '频道 owner')
        : '未处理')

  if (!token) {
    return (
      <LoginRequiredState
        title="管理员审核详情"
        description="请先用管理员账号密码登录，然后再查看审核详情。"
      />
    )
  }

  const handleDecision = async (decision) => {
    if (decision === 'approve' && deploymentMode === 'manual' && !String(manualApprovalDraft.tgGroupId || '').trim()) {
      setActionState({ state: 'error', message: '独立部署申请在通过前必须先填写 TG 群 ID。' })
      return
    }
    setActionState({
      state: 'loading',
      message: decision === 'approve' ? '正在通过创建审核…' : '正在驳回创建审核…',
    })
    try {
      const body = {
        ...(decision === 'approve' && deploymentMode === 'manual'
          ? {
            manualChannel: {
              publicUrl: String(manualApprovalDraft.publicUrl || '').trim(),
              tgGroupId: String(manualApprovalDraft.tgGroupId || '').trim() || undefined,
            },
          }
          : {}),
      }
      await requestApi(
        `/v1/review-requests/${encodeURIComponent(reviewRequestId)}/${decision}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
        token,
      )
      await refetch()
      setActionState({
        state: 'success',
        message: decision === 'approve' ? `创建审核 ${reviewRequestId} 已通过。` : `创建审核 ${reviewRequestId} 已驳回。`,
      })
    } catch (requestError) {
      setActionState({ state: 'error', message: requestError.message || '处理创建审核失败。' })
    }
  }

  if (isLoading) {
    return (
      <div className="detail">
        <p className="eyebrow">Admin</p>
        <h1>加载审核详情中</h1>
        <p className="lead">正在读取创建审核详情和审核轨迹。</p>
      </div>
    )
  }

  if (!reviewRequest || error) {
    return (
      <div className="detail">
        <p className="eyebrow">Admin</p>
        <h1>未找到该审核请求</h1>
        <p className="lead">{error || '请返回管理员审核列表重新选择。'}</p>
        <Link className="primary" to="/admin/review-requests">返回审核后台</Link>
      </div>
    )
  }

  return (
    <div className="detail">
      <p className="eyebrow">Admin</p>
      <h1>{reviewRequest.title || '管理员审核详情'}</h1>
      <p className="lead">这里会展示创建频道申请的完整内容、申请人信息、敏感字段摘要和审核执行轨迹。独立部署申请需要在通过前回填最终频道入口。</p>
      <AdminNavTabs />
      {reviewRequest.status === 'pending' && deploymentMode === 'manual' && (
        <section className="resources resource-panel">
          <h2>独立部署回填</h2>
          <p className="section-copy">管理员独立部署完成后，在这里填写 TG 群 ID；频道链接可以留空，系统会按 TG 群 ID 自动生成。通过审核时，系统会直接创建一个独立部署频道，效果类似当前导入的那几条独立频道。</p>
          <div className="editor-grid channel-create-form">
            <label className="editor-field">
              <span>TG 群 ID</span>
              <input
                type="text"
                value={manualApprovalDraft.tgGroupId}
                onChange={(event) => setManualApprovalDraft((current) => ({ ...current, tgGroupId: event.target.value }))}
                placeholder="例如 -1001234567890"
              />
            </label>
            <label className="editor-field editor-field-wide">
              <span>频道入口链接（可选）</span>
              <input
                type="url"
                value={manualApprovalDraft.publicUrl}
                onChange={(event) => setManualApprovalDraft((current) => ({ ...current, publicUrl: event.target.value }))}
                placeholder="留空则根据 TG 群 ID 自动生成，例如 https://t.me/c/1234567890/1"
              />
            </label>
          </div>
        </section>
      )}
      <ReviewRequestDetailContent
        reviewRequest={reviewRequest}
        events={events}
        actionState={actionState}
        onDecision={handleDecision}
        canApproveOrReject={reviewRequest.status === 'pending'}
        backTo="/admin/review-requests"
        backLabel="返回审核后台"
        expectedReviewerLabel={expectedReviewerLabel}
      />
    </div>
  )
}

const HeaderAuthControl = () => {
  const { session, adminSession, setSession, setAdminSession } = useSessionState()
  const [status, setStatus] = useState({ state: 'idle', message: '' })
  const [hasFetchedProfile, setHasFetchedProfile] = useState(Boolean(session.profileName))

  const { address, isConnected } = useAccount()
  const { connect, connectors, status: connectStatus, error: connectError, variables: connectVariables } = useConnect()
  const { disconnect } = useDisconnect()
  const { signMessageAsync } = useSignMessage()

  const normalizedAddress = address?.toLowerCase() || ''

  const fetchNonce = async (walletAddress) => {
    const response = await fetch(LOGIN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: GET_NONCE_QUERY,
        operationName: 'getNonce',
        variables: { address: walletAddress },
      }),
    })

    if (!response.ok) {
      throw new Error(`获取 nonce 失败：HTTP ${response.status}`)
    }

    const result = await response.json()
    const nonce = result?.data?.getNonce?.data
    if (!nonce) {
      throw new Error('未从后台获取 nonce')
    }
    return nonce
  }

  const fetchProfile = useCallback(async (userId, token, silent = false) => {
    if (!silent) {
      setStatus({ state: 'loading', message: '拉取用户信息…' })
    }

    try {
      const response = await fetch(LOGIN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: PROFILE_QUERY,
          operationName: 'getUserDetail',
          variables: { id: String(userId) },
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const result = await response.json()
      const detail = result?.data?.getUserDetail?.data

      if (detail?.name) {
        setSession((prev) => ({ ...prev, profileName: detail.name, token, userId }))
        setStatus({ state: 'success', message: '登录完成，可调用工作流。' })
      } else {
        const firstError = result?.errors?.[0]?.message || '未返回用户信息。'
        setStatus({ state: 'error', message: firstError })
      }
    } catch (error) {
      setStatus({ state: 'error', message: error.message || '拉取用户信息失败。' })
    }
  }, [setSession])

  useEffect(() => {
    if (!session.token || !session.userId) {
      setHasFetchedProfile(false)
      return
    }
    if (session.profileName) {
      setHasFetchedProfile(true)
      return
    }
    if (!hasFetchedProfile) {
      fetchProfile(session.userId, session.token, true).finally(() => setHasFetchedProfile(true))
    }
  }, [fetchProfile, hasFetchedProfile, session.profileName, session.token, session.userId])

  const handleLoginFlow = async () => {
    if (!isConnected || !normalizedAddress) {
      setStatus({ state: 'error', message: '请先连接钱包。' })
      return
    }

    setStatus({ state: 'loading', message: '唤起钱包签名…' })
    try {
      const nonce = await fetchNonce(normalizedAddress)
      const message = `Sign this message to authenticate your wallet address \nNonce: ${nonce}\nAddress: ${normalizedAddress}`
      const signature = await signMessageAsync({ message })

      const response = await fetch(LOGIN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: LOGIN_QUERY,
          operationName: 'login',
          variables: {
            req: {
              ethAddress: normalizedAddress,
              signature,
            },
          },
        }),
      })

      if (!response.ok) {
        throw new Error(`登录失败：HTTP ${response.status}`)
      }

      const result = await response.json()
      const loginData = result?.data?.login?.data

      if (loginData?.token && loginData?.userId) {
        setSession({ token: loginData.token, userId: loginData.userId, profileName: '' })
        await fetchProfile(loginData.userId, loginData.token)
        setHasFetchedProfile(true)
      } else {
        const firstError = result?.errors?.[0]?.message || '未返回 token，请检查签名是否有效。'
        setStatus({ state: 'error', message: firstError })
      }
    } catch (error) {
      const message = error?.message === 'User rejected the request.' ? '你取消了签名，请重试。' : (error.message || '登录失败，请稍后再试。')
      setStatus({ state: 'error', message })
    }
  }

  const handlePrimaryClick = () => {
    if (!isConnected) {
      const defaultConnector = connectors[0]
      if (!defaultConnector) {
        setStatus({ state: 'error', message: '未检测到浏览器钱包，请先安装。' })
        return
      }
      connect({ connector: defaultConnector })
      return
    }

    if (!session.token) {
      handleLoginFlow()
    }
  }

  const handleLogout = () => {
    disconnect()
    setSession(INITIAL_SESSION)
    setStatus({ state: 'idle', message: '已退出登录。' })
    setHasFetchedProfile(false)
  }

  const handleAdminLogout = () => {
    setAdminSession(INITIAL_ADMIN_SESSION)
  }

  const primaryMode = !isConnected ? 'connect' : session.token ? 'profile' : 'login'
  const buttonLabel = primaryMode === 'connect'
    ? (connectStatus === 'pending' ? '连接中…' : '连接钱包')
    : primaryMode === 'login'
      ? (status.state === 'loading' ? '登录中…' : '登录工作流')
      : (session.profileName || (normalizedAddress ? `${normalizedAddress.slice(0, 6)}…${normalizedAddress.slice(-4)}` : '已登录'))

  const showStatusMessage = status.message && status.state !== 'success'

  return (
    <div className="header-auth" id="header-auth-control">
      <button
        type="button"
        className="primary"
        onClick={handlePrimaryClick}
        disabled={(primaryMode === 'login' && status.state === 'loading') || (primaryMode === 'connect' && connectStatus === 'pending')}
      >
        {buttonLabel}
      </button>
      {session.token && (
        <div className="session-actions">
          <button type="button" className="ghost" onClick={handleLogout}>
            退出
          </button>
        </div>
      )}
      {adminSession.token && (
        <div className="session-actions admin-session-actions">
          <Link className="ghost" to="/admin/review-requests">
            管理员：{adminSession.username || '已登录'}
          </Link>
          <button type="button" className="ghost" onClick={handleAdminLogout}>
            退出管理端
          </button>
        </div>
      )}
      {!isConnected && connectors.length > 1 && (
        <div className="connector-list">
          {connectors.map((connector) => (
            <button
              type="button"
              className="ghost"
              key={connector.id ?? connector.uid ?? connector.name}
              onClick={() => connect({ connector })}
              disabled={connectStatus === 'pending' && connectVariables?.connector?.id === connector.id}
            >
              {connectStatus === 'pending' && connectVariables?.connector?.id === connector.id ? '连接中…' : connector.name}
            </button>
          ))}
        </div>
      )}
      {connectError && <p className="mini-status error">{connectError.message}</p>}
      {showStatusMessage && <p className={`mini-status ${status.state}`}>{status.message}</p>}
    </div>
  )
}

const NotFound = () => (
  <div className="detail">
    <h1>404</h1>
    <p className="lead">找不到该页面，请返回主页。</p>
    <Link className="primary" to="/">返回主页</Link>
  </div>
)

function App() {
  return (
    <SessionProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/workflows/:workflowId" element={<WorkflowDetail />} />
            <Route path="/channels/:idOrSlug" element={<ChannelDetail />} />
            <Route path="/me/channels" element={<MyChannels />} />
            <Route path="/me/review-requests" element={<MyReviewRequestsPage />} />
            <Route path="/me/review-requests/:reviewRequestId" element={<ReviewRequestDetailPage />} />
            <Route path="/me/channels/new" element={<CreateManagedChannel />} />
            <Route path="/me/channels/:channelId" element={<ManagedChannelDetailRoute />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/review-requests" element={<AdminReviewRequests />} />
            <Route path="/admin/queue-overview" element={<AdminQueueOverviewPage />} />
            <Route path="/admin/review-requests/:reviewRequestId" element={<AdminReviewRequestDetail />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </Router>
    </SessionProvider>
  )
}

export default App
