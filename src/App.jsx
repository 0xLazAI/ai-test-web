import { useMemo, useState } from 'react'
import './App.css'
import { BrowserRouter as Router, Routes, Route, NavLink, Link, useParams } from 'react-router-dom'

const LOGIN_ENDPOINT = 'https://api.lazpad.fun/lazai'
const LOGIN_QUERY = 'mutation login($req: LoginReq!) { login(req: $req) { data { userId token } } } '
const PROFILE_QUERY = 'query getUserDetail($id: String!) { getUserDetail(id: $id) { data { name } success traceId } } '

const workflows = [
  {
    id: 'singularity-studio',
    name: '奇点工作室的工作流',
    description: '端到端内容工作流，覆盖素材采集、逻辑对垒、导演翻译与多渠道分发。',
    owner: '奇点工作室',
    status: 'Alpha · 内测',
    cadence: '每日多轮迭代',
    lastUpdated: '2026-02-17',
    metrics: [
      { label: '节点', value: '7 个' },
      { label: '负责人', value: '主编 + Sentinel' },
      { label: '上线渠道', value: 'Telegram / B站 / Newsletter' }
    ],
    phases: [
      '素材雷达：AI 热点 + 原典补库',
      '主编选题：3-5 个命题 + 观点挑选',
      '逻辑对垒：Sentinel 与 Adversary 多轮 PK',
      '导演翻译：将逻辑资产转成可消费内容',
      '多渠道改写：口播脚本、剪辑稿、推送文',
      '反馈回灌：热点升级与 rejected logic log 入库'
    ],
    resources: [
      { label: '执行 SOP', url: 'https://example.com/sop' },
      { label: '素材金库', url: 'https://example.com/vault' }
    ]
  }
]

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
        <nav>
          <NavLink to="/" end>主页</NavLink>
          <NavLink to="/workflows/singularity-studio">奇点工作流</NavLink>
          <NavLink to="/login">登录</NavLink>
        </nav>
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
  return (
    <div className="home">
      <section className="hero">
        <p className="eyebrow">APIXLab · Workflow Catalog</p>
        <h1>把灵感固化成可复用的<br />API 级工作流</h1>
        <p className="lead">
          APIXLab 聚焦多智能体内容生产实验。所有工作流都经过实战验证，
          可直接复用到团队 SOP 或作为自建平台的模板。
        </p>
        <div className="hero-actions">
          <Link className="primary" to="/workflows/singularity-studio">查看奇点工作流</Link>
          <Link className="ghost" to="/login">登录 / 获取权限</Link>
        </div>
      </section>

      <section className="workflow-list">
        <div className="section-head">
          <div>
            <p className="eyebrow">工作流列表</p>
            <h2>当前可调用的 API 工作流</h2>
          </div>
          <span className="count">{workflows.length} 套</span>
        </div>

        <div className="workflow-grid">
          {workflows.map((flow) => (
            <article key={flow.id} className="workflow-card">
              <div>
                <p className="chip">{flow.status}</p>
                <h3>{flow.name}</h3>
                <p className="muted">{flow.description}</p>
              </div>
              <dl>
                <div>
                  <dt>Owner</dt>
                  <dd>{flow.owner}</dd>
                </div>
                <div>
                  <dt>节奏</dt>
                  <dd>{flow.cadence}</dd>
                </div>
                <div>
                  <dt>更新</dt>
                  <dd>{flow.lastUpdated}</dd>
                </div>
              </dl>
              <Link className="ghost" to={`/workflows/${flow.id}`}>
                查看详情 →
              </Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

const WorkflowDetail = () => {
  const { workflowId } = useParams()
  const workflow = workflows.find((flow) => flow.id === workflowId)

  const checklist = useMemo(() => [
    '在 APIXLab 主页提交申请，写明目标 Telegram 群链接/ID',
    '管理员审批后，将群 ID 写入 OpenClaw 配置并邀请 @jims_openclaw_test_bot',
    '如需 PK，管理员同步拉入 @jimDuelBot，用户按奇点 SOP 调用',
    '群内调用时，先在群里 @bot，跟随 SOP 阶段逐步执行'
  ], [])

  if (!workflow) {
    return (
      <div className="detail">
        <p className="eyebrow">Workflow</p>
        <h1>未找到该工作流</h1>
        <p className="lead">请返回主页，或联系 APIXLab 获取更多配置。</p>
        <Link className="primary" to="/">返回主页</Link>
      </div>
    )
  }

  return (
    <div className="detail">
      <p className="eyebrow">Workflow</p>
      <h1>{workflow.name}</h1>
      <p className="lead">{workflow.description}</p>

      <div className="stats">
        {workflow.metrics.map((metric) => (
          <div key={metric.label}>
            <p className="stat-value">{metric.value}</p>
            <p className="stat-label">{metric.label}</p>
          </div>
        ))}
      </div>

      <section className="phases">
        <h2>核心阶段</h2>
        <ol>
          {workflow.phases.map((phase, index) => (
            <li key={phase}>
              <span>{index + 1}</span>
              <p>{phase}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="resources">
        <h2>接入指南</h2>
        <div className="resource-links flow-guide">
          <div>
            <p className="guide-title">使用流程</p>
            <ol>
              {checklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </div>
          <div>
            <p className="guide-title">机器人清单</p>
            <ul>
              <li>@jims_openclaw_test_bot —— 主流程 / SOP 执行</li>
              <li>@jimDuelBot —— 逻辑对垒 / Sentinel PK</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="resources">
        <h2>相关资源</h2>
        <div className="resource-links">
          {workflow.resources.map((item) => (
            <a key={item.label} href={item.url} target="_blank" rel="noreferrer">
              {item.label}
            </a>
          ))}
        </div>
      </section>

      <Link className="primary" to="/">返回 APIXLab</Link>
    </div>
  )
}

const Login = () => {
  const [form, setForm] = useState({ ethAddress: '', signature: '', invitedCode: '' })
  const [session, setSession] = useState({ token: null, userId: null })
  const [status, setStatus] = useState({ state: 'idle', message: '' })
  const [profileName, setProfileName] = useState('')
  const [profileStatus, setProfileStatus] = useState({ state: 'idle', message: '' })

  const handleChange = (evt) => {
    const { name, value } = evt.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const fetchProfile = async (userId, token) => {
    setProfileStatus({ state: 'loading', message: '拉取用户信息…' })
    setProfileName('')

    try {
      const response = await fetch(LOGIN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          query: PROFILE_QUERY,
          operationName: 'getUserDetail',
          variables: { id: String(userId) }
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const result = await response.json()
      const detail = result?.data?.getUserDetail?.data

      if (detail?.name) {
        setProfileName(detail.name)
        setProfileStatus({ state: 'success', message: '已获取用户信息。' })
      } else {
        const firstError = result?.errors?.[0]?.message || '未返回用户信息。'
        setProfileStatus({ state: 'error', message: firstError })
      }
    } catch (error) {
      setProfileStatus({ state: 'error', message: error.message })
    }
  }

  const handleSubmit = async (evt) => {
    evt.preventDefault()
    setStatus({ state: 'loading', message: '正在登录…' })
    setSession({ token: null, userId: null })
    setProfileName('')
    setProfileStatus({ state: 'idle', message: '' })

    const payload = {
      query: LOGIN_QUERY,
      operationName: 'login',
      variables: {
        req: {
          ethAddress: form.ethAddress.trim(),
          signature: form.signature.trim(),
          invitedCode: form.invitedCode.trim()
        }
      }
    }

    try {
      const response = await fetch(LOGIN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const result = await response.json()
      const loginData = result?.data?.login?.data

      if (loginData?.token && loginData?.userId) {
        setStatus({ state: 'success', message: '登录成功。token 可用于后续接口调用。' })
        setSession({ token: loginData.token, userId: loginData.userId })
        fetchProfile(loginData.userId, loginData.token)
      } else {
        const firstError = result?.errors?.[0]?.message || '未返回 token，请检查签名是否有效。'
        setStatus({ state: 'error', message: firstError })
      }
    } catch (error) {
      setStatus({ state: 'error', message: error.message || '登录失败，请稍后再试。' })
    }
  }

  const disabled = !form.ethAddress || !form.signature
  const canRefreshProfile = Boolean(session.token && session.userId && profileStatus.state !== 'loading')

  return (
    <div className="auth">
      <section className="auth-card">
        <div>
          <p className="eyebrow">APIXLab Access</p>
          <h1>签名登录</h1>
          <p className="lead">使用以太坊地址 + 签名完成登录，可在成功后获得 token，绑定 Telegram 工作流权限。</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>Eth Address</span>
            <input
              name="ethAddress"
              value={form.ethAddress}
              onChange={handleChange}
              placeholder="0x..."
              required
              autoComplete="off"
            />
          </label>

          <label>
            <span>Signature</span>
            <textarea
              name="signature"
              value={form.signature}
              onChange={handleChange}
              placeholder="0x签名"
              required
            />
          </label>

          <label>
            <span>Invited Code（可选）</span>
            <input
              name="invitedCode"
              value={form.invitedCode}
              onChange={handleChange}
              placeholder="邀请码"
            />
          </label>

          <button type="submit" className="primary" disabled={disabled || status.state === 'loading'}>
            {status.state === 'loading' ? '登录中…' : '登录 APIXLab'}
          </button>
        </form>

        {status.state !== 'idle' && (
          <div className={`auth-status ${status.state}`}>
            <p>{status.message}</p>
            {session.token && (
              <div className="token-box">
                <span>Token：</span>
                <code>{session.token}</code>
              </div>
            )}
          </div>
        )}

        {session.token && (
          <div className="profile-panel">
            <div className="profile-head">
              <p>用户信息</p>
              <button
                className="ghost"
                type="button"
                disabled={!canRefreshProfile}
                onClick={() => fetchProfile(session.userId, session.token)}
              >
                刷新
              </button>
            </div>
            <div className={`auth-status ${profileStatus.state}`}>
              <p>{profileStatus.message || '尚未拉取用户信息。'}</p>
            </div>
            {profileName && (
              <div className="profile-name">
                <span>姓名 / Name</span>
                <strong>{profileName}</strong>
              </div>
            )}
          </div>
        )}

        <div className="auth-hint">
          <p>如何生成签名？</p>
          <ol>
            <li>使用钱包（如 Rainbow / MetaMask）对 APIXLab challenge 文本签名。</li>
            <li>将签名粘贴到上方输入框，提交后即可获得 token。</li>
            <li>token 用于调用 API 或在 Telegram 中绑定工作流权限。</li>
          </ol>
        </div>
      </section>
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
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/workflows/:workflowId" element={<WorkflowDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App
