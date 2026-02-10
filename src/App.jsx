import './App.css'

function App() {
  return (
    <div className="app">
      <div className="login-card">
        <div className="brand">
          <div className="brand-mark">L</div>
          <div>
            <h1>Welcome back</h1>
            <p>Sign in to continue</p>
          </div>
        </div>

        <form className="login-form">
          <label className="field">
            <span>Username</span>
            <input type="text" name="username" placeholder="yourname" autoComplete="username" />
          </label>

          <label className="field">
            <span>Password</span>
            <input type="password" name="password" placeholder="••••••••" autoComplete="current-password" />
          </label>

          <button type="submit" className="primary-btn">Sign in</button>
        </form>

        <div className="footer">Need an account? Contact your admin.</div>
      </div>
    </div>
  )
}

export default App
