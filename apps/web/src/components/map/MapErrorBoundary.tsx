import { Component, type ReactNode } from 'react'

/**
 * A failing map must never take the application down with it.
 *
 * MapLibre throws synchronously when it cannot get a WebGL context, and a tile provider
 * can fail in ways no feature check predicts. React unmounts the entire tree on an
 * uncaught render error, which would turn a map problem into a blank page — so the map
 * is isolated behind this boundary and anything it throws degrades to the fallback
 * surface instead.
 */
export class MapErrorBoundary extends Component<
  { children: ReactNode; fallback: (reason: string) => ReactNode },
  { failed: boolean; reason: string }
> {
  state = { failed: false, reason: '' }

  static getDerivedStateFromError(error: unknown) {
    const raw = error instanceof Error ? error.message : String(error)
    const reason = /webgl/i.test(raw)
      ? 'This browser could not create a WebGL context, which the interactive map needs.'
      : 'The interactive map failed to start.'
    return { failed: true, reason }
  }

  componentDidCatch(error: unknown) {
    // Observable, and deliberately free of user data.
    console.error('[Homi] map failed to initialise:', error)
  }

  render() {
    if (this.state.failed) return this.props.fallback(this.state.reason)
    return this.props.children
  }
}
