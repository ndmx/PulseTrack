import React from "react"
import { useRouteError, isRouteErrorResponse } from "react-router-dom"

export default function RouteError() {
  const err = useRouteError() as any
  const isResp = isRouteErrorResponse(err)
  const message = isResp
    ? `${err.status} ${err.statusText}`
    : (err?.message || 'Something went wrong')

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 640 }}>
        <h1 style={{ margin: 0 }}>Oops, something went wrong</h1>
        <p style={{ color: '#6C757D' }}>{message}</p>
        {import.meta.env.DEV && err?.stack && (
          <details>
            <summary>Stack</summary>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{String(err.stack)}</pre>
          </details>
        )}
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button onClick={() => window.location.reload()}>
            Reload
          </button>
          <button onClick={() => window.history.back()}>
            Go Back
          </button>
        </div>
      </div>
    </div>
  )
}


