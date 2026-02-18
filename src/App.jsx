import { useMemo, useState, useEffect } from 'react'
import './App.css'
import { BrowserRouter as Router, Routes, Route, Link, useParams, useNavigate } from 'react-router-dom'
import { useAccount, useConnect, useDisconnect, useSignMessage } from 'wagmi'

const LOGIN_ENDPOINT = 'https://api.lazpad.fun/lazai'
const LOGIN_QUERY = 'mutation login($req: LoginReq!) { login(req: $req) { data { userId token } } } '
const PROFILE_QUERY = 'query getUserDetail($id: String!) { getUserDetail(id: $id) { data { name } success traceId } } '
const GET_NONCE_QUERY = 'query getNonce($address: String!) { getNonce(address: $address) { data } } '

const workflows = [
  {
    id: 'singularity-studio',
    name: '奇点编辑部的工作流',
    description: '端到端内容工作流，覆盖素材采集、逻辑对垒、导演翻译与多渠道分发。',
    owner: '奇点编辑部',
    status: 'Alpha · 内测',
    cadence: '每日多轮迭代',
    lastUpdated: '2026-02-17',
    metrics: [
      { label: '节点', value: '7 个' },
      { label: '负责人', value: 'Steven（@mnpemu）、Jim（@jimMao0x1）' },
      { label: '上线渠道', value: 'Telegram' }
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
        <HeaderAuthControl />
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

  return (
    <div className="home">
      <section className="hero">
        <p className="eyebrow">APIXLab · Workflow Catalog</p>
        <h1>把灵感固化成可复用的<br />API 级工作流</h1>
        <p className="lead">
          APIXLab 聚焦多智能体内容生产实验。所有工作流都经过实战验证，
          可直接复用到团队 SOP 或作为自建平台的模板。
        </p>
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
              <div className="workflow-cta">
                <div>
                  <p className="chip">{flow.status}</p>
                  <h3>{flow.name}</h3>
                  <p className="muted">{flow.description}</p>
                </div>
                <button type="button" onClick={() => navigate(`/workflows/${flow.id}`)}>
                  查看工作流并接入
                </button>
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

      <section className="resources">
        <h2>频道列表</h2>
        <div className="channel-list">
          <div className="channel-item">
            <div>
              <p className="channel-title">AI 科技</p>
              <p className="channel-desc">即时获取 AI 热点和实战 SOP</p>
            </div>
            <a href="https://t.me/+4px6o2YVVBw3ZjQ1" target="_blank" rel="noreferrer">加入频道</a>
          </div>
          <div className="channel-item">
            <div>
              <p className="channel-title">黑暗幻想</p>
              <p className="channel-desc">黑暗叙事、逻辑对垒与世界观共创</p>
            </div>
            <a href="https://t.me/+whfhVny20DAzYWU1" target="_blank" rel="noreferrer">加入频道</a>
          </div>
          <div className="channel-item coming-soon">
            <div>
              <p className="channel-title">创建新频道</p>
              <p className="channel-desc">Coming soon —— 支持自定义频道与自动化接入</p>
            </div>
            <span>敬请期待</span>
          </div>
        </div>
      </section>

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


const SESSION_KEY = 'apixlab_session'
const INITIAL_SESSION = { token: null, userId: null, profileName: '' }

const HeaderAuthControl = () => {
  const [session, setSession] = useState(() => {
    try {
      const stored = localStorage.getItem(SESSION_KEY)
      return stored ? { ...INITIAL_SESSION, ...JSON.parse(stored) } : INITIAL_SESSION
    } catch {
      return INITIAL_SESSION
    }
  })
  const [status, setStatus] = useState({ state: 'idle', message: '' })

  const { address, isConnected } = useAccount()
  const { connect, connectors, status: connectStatus, error: connectError, variables: connectVariables } = useConnect()
  const { disconnect } = useDisconnect()
  const { signMessageAsync, status: signStatus } = useSignMessage()

  const normalizedAddress = address?.toLowerCase() || ''

  useEffect(() => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  }, [session])

  const fetchNonce = async (walletAddress) => {
    const response = await fetch(LOGIN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: GET_NONCE_QUERY,
        operationName: 'getNonce',
        variables: { address: walletAddress }
      })
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

  const fetchProfile = async (userId, token, silent = false) => {
    if (!silent) {
      setStatus({ state: 'loading', message: '拉取用户信息…' })
    }

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
        setSession(prev => ({ ...prev, profileName: detail.name, token, userId }))
        setStatus({ state: 'success', message: '登录完成，可调用工作流。' })
      } else {
        const firstError = result?.errors?.[0]?.message || '未返回用户信息。'
        setStatus({ state: 'error', message: firstError })
      }
    } catch (error) {
      setStatus({ state: 'error', message: error.message || '拉取用户信息失败。' })
    }
  }

  useEffect(() => {
    if (session.token && session.userId && !session.profileName) {
      fetchProfile(session.userId, session.token, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.token, session.userId])

  const handleLoginFlow = async () => {
    if (!isConnected || !normalizedAddress) {
      setStatus({ state: 'error', message: '请先连接钱包。' })
      return
    }

    setStatus({ state: 'loading', message: '唤起钱包签名…' })
    try {
      const nonce = await fetchNonce(normalizedAddress)
      //Sign this message to authenticate your wallet address \nNonce: a6154976-698d-4b5e-98b4-79ab9e9da96d\nAddress: 0xd4F8bbF9c0B8AFF6D76d2C5Fa4971a36fC9e4003
      const message = `Sign this message to authenticate your wallet address \nNonce: ${nonce}\nAddress: ${normalizedAddress}`
      const signature = await signMessageAsync({ message })

      const payload = {
        query: LOGIN_QUERY,
        operationName: 'login',
        variables: {
          req: {
            ethAddress: normalizedAddress,
            signature
          }
        }
      }

      const response = await fetch(LOGIN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error(`登录失败：HTTP ${response.status}`)
      }

      const result = await response.json()
      const loginData = result?.data?.login?.data

      if (loginData?.token && loginData?.userId) {
        setSession({ token: loginData.token, userId: loginData.userId, profileName: '' })
        await fetchProfile(loginData.userId, loginData.token)
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
      return
    }
  }

  const handleLogout = () => {
    disconnect()
    setSession(INITIAL_SESSION)
    setStatus({ state: 'idle', message: '已退出登录。' })
  }

  const primaryMode = !isConnected ? 'connect' : session.token ? 'profile' : 'login'
  const buttonLabel = primaryMode === 'connect'
    ? (connectStatus === 'pending' ? '连接中…' : '连接钱包')
    : primaryMode === 'login'
      ? (status.state === 'loading' ? '登录中…' : '登录工作流')
      : (session.profileName || (normalizedAddress ? `${normalizedAddress.slice(0, 6)}…${normalizedAddress.slice(-4)}` : '已登录'))

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
      {status.message && <p className={`mini-status ${status.state}`}>{status.message}</p>}
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
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App
