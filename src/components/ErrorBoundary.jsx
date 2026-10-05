import { Component } from 'react'

/** Last line of defence: a calm screen instead of a blank page. */
export default class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    console.error(error, info.componentStack)
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="page container empty" role="alert">
        <p className="h3 serif">Something went wrong.<br /><em>Not your fault.</em></p>
        <button className="btn" onClick={() => window.location.reload()}>Reload</button>
      </div>
    )
  }
}
