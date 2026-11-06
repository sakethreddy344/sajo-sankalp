import { useCallback, useEffect, useRef, useState } from 'react'
import './ConfirmDialog.css'

export default function useConfirmDialog() {
  const [request, setRequest] = useState(null)
  const resolveRequest = useRef(null)
  const cancelButton = useRef(null)

  const confirmAction = useCallback((options) => new Promise((resolve) => {
    resolveRequest.current?.(false)
    resolveRequest.current = resolve
    setRequest(options)
  }), [])

  const finish = useCallback((confirmed) => {
    resolveRequest.current?.(confirmed)
    resolveRequest.current = null
    setRequest(null)
  }, [])

  useEffect(() => {
    if (!request) return undefined

    cancelButton.current?.focus()
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') finish(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [request, finish])

  const confirmationDialog = request && (
    <div className="app-confirm-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) finish(false)
    }}>
      <section
        className="app-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="app-confirm-title"
        aria-describedby="app-confirm-message"
      >
        <div className="app-confirm-icon" aria-hidden="true">!</div>
        <h2 id="app-confirm-title">{request.title || 'Are you sure?'}</h2>
        <p id="app-confirm-message">{request.message}</p>
        <div className="app-confirm-actions">
          <button ref={cancelButton} type="button" className="app-confirm-cancel" onClick={() => finish(false)}>
            {request.cancelLabel || 'Cancel'}
          </button>
          <button type="button" className="app-confirm-accept" onClick={() => finish(true)}>
            {request.confirmLabel || 'Delete'}
          </button>
        </div>
      </section>
    </div>
  )

  return { confirmAction, confirmationDialog }
}
