import './App.css'
import { BrowserRouter as Router, Routes, Route, NavLink, Link, useParams } from 'react-router-dom'

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
          <a className="ghost" href="mailto:contact@apixlab.studio">联系我们</a>
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
