import { Component } from 'react'

// 3D sahna xato bersa ham yon panel ishlashda davom etadi va xato matni ko'rinadi
export default class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) {
    return { error }
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-xl rounded-xl bg-slate-900 p-6 text-sm">
          <h2 className="mb-2 text-base font-semibold text-red-400">3D sahnani ko'rsatib bo'lmadi</h2>
          <p className="mb-3 text-slate-300">
            Brauzerda WebGL yoqilganligini tekshiring (chrome://settings → System → "Use graphics acceleration when available").
          </p>
          <pre className="whitespace-pre-wrap rounded bg-slate-950 p-3 text-xs text-slate-400">{String(this.state.error?.message || this.state.error)}</pre>
        </div>
      </div>
    )
  }
}
