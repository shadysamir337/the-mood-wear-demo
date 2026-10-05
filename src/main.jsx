import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/site.css'
import './styles/admin.css'
import App from './App.jsx'
import { demoBlocked } from './lib/config'

/** A production build without Firebase keys must never run the browser-only demo store. */
function NotConfigured() {
  return (
    <div className="page container empty" style={{ minHeight: '100vh' }}>
      <p className="eyebrow">THE MOOD</p>
      <h1 className="h2">Opening soon.</h1>
      <p className="muted">The store isn't connected yet.</p>
    </div>
  )
}

// Pages are prerendered for search engines and link previews; drop those head tags so React's own copies are the only ones.
document.querySelectorAll('[data-prerender]').forEach((el) => el.remove())

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {demoBlocked ? <NotConfigured /> : <App />}
  </StrictMode>,
)
