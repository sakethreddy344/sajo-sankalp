import { useEffect, useRef, useState } from 'react'
import { normalizeAssistantLines } from './assistantFormatting'
import { supabase } from './supabase'
import './AIAssistant.css'

const currentMonthLabel = new Intl.DateTimeFormat('en-IN', {
  month: 'long',
  year: 'numeric',
}).format(new Date())
const currentDate = new Date()
const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
const quickActions = [
  {
    mode: 'money',
    title: `${currentMonthLabel} money analysis`,
    description: 'Income, spending, categories, budget, EMIs and commitments.',
    prompt: `Give me a detailed analysis of my money for ${currentMonthLabel}. Review every available transaction field, monthly totals and category totals, budget, cards, EMIs, subscriptions, holdings and chit funds. Highlight patterns, possible duplicate counting, risks and practical next steps. Be precise about missing data.`,
    icon: '₹',
  },
  {
    mode: 'trips',
    title: 'Trip analysis',
    description: 'Compare trip expenses, bookings and travel plans.',
    prompt: 'Analyze my saved trips and trip-only expenses. Show totals by trip, the biggest cost areas, booking notes, useful comparisons, and practical ways to plan future trips. Do not mix trip-only expenses with my main money ledger.',
    icon: '↗',
  },
]

function getErrorMessage(error) {
  if (error?.context instanceof Response) {
    return error.context.json()
      .then((body) => body?.error || error.message)
      .catch(() => error.message)
  }
  return Promise.resolve(error?.message || 'The AI request failed. Please try again.')
}

function formatInlineMarkdown(text) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*)/g).filter(Boolean).map((part, partIndex) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={partIndex}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={partIndex}>{part.slice(1, -1)}</em>
    }
    return part
  })
}

function isMarkdownTableRow(line) {
  const trimmed = line.trim()
  return trimmed.startsWith('|') && trimmed.endsWith('|')
}

function isMarkdownTableSeparator(line) {
  return isMarkdownTableRow(line)
    && line.trim().slice(1, -1).split('|').every((cell) => /^:?-{3,}:?$/.test(cell.trim()))
}

function markdownTableCells(line) {
  return line.trim().slice(1, -1).split('|').map((cell) => cell.trim())
}

function formatAssistantText(content) {
  const lines = normalizeAssistantLines(content)
  const elements = []

  for (let index = 0; index < lines.length;) {
    if (isMarkdownTableRow(lines[index])) {
      const tableLines = []
      while (index < lines.length && isMarkdownTableRow(lines[index])) {
        if (!isMarkdownTableSeparator(lines[index])) tableLines.push(markdownTableCells(lines[index]))
        index += 1
      }

      if (tableLines.length > 1) {
        const [headers, ...rows] = tableLines
        elements.push(
          <div className="ai-table-scroll" role="region" aria-label="Analysis table" tabIndex={0} key={`table-${index}`}>
            <table className="ai-result-table">
              <thead><tr>{headers.map((cell, cellIndex) => <th scope="col" key={cellIndex}>{formatInlineMarkdown(cell)}</th>)}</tr></thead>
              <tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>
                {headers.map((_, cellIndex) => <td key={cellIndex}>{formatInlineMarkdown(row[cellIndex] || '')}</td>)}
              </tr>)}</tbody>
            </table>
          </div>,
        )
      }
      continue
    }

    const line = lines[index]
    const heading = line.match(/^#{1,3}\s+(.+)$/)
    const listItem = line.match(/^\s*([-*]|\d+[.)])\s+(.+)$/)
    const bullet = listItem?.[2]
    const ordered = Boolean(listItem && /^\d/.test(listItem[1]))
    const text = heading ? heading[1] : bullet ? bullet[1] : line
    const parts = formatInlineMarkdown(text)

    if (!line.trim()) elements.push(<div className="ai-message-spacer" key={index} />)
    else if (heading) elements.push(<h3 className="ai-message-heading" key={index}>{parts}</h3>)
    else elements.push(<p className={bullet ? `ai-message-list-item${ordered ? ' ai-message-ordered' : ''}` : undefined} data-marker={ordered ? listItem[1] : undefined} key={index}>{parts}</p>)
    index += 1
  }

  return elements
}

export default function AIAssistant({ isOpen, onClose, session, data, dataReady, dataError, confirmAction }) {
  const [mode, setMode] = useState('')
  const [messages, setMessages] = useState([])
  const [conversations, setConversations] = useState([])
  const [conversationId, setConversationId] = useState('')
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [historyActionId, setHistoryActionId] = useState('')
  const [editingConversationId, setEditingConversationId] = useState('')
  const [editingConversationTitle, setEditingConversationTitle] = useState('')
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [copiedMessageIndex, setCopiedMessageIndex] = useState(-1)
  const messageListRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    setConversations([])
    setMode('')
    setMessages([])
    setConversationId('')
    setDraft('')
    setError('')
  }, [session?.user?.id])

  useEffect(() => {
    if (!isOpen || !session || !supabase) return undefined

    let active = true
    setHistoryLoading(true)
    setHistoryError('')
    supabase
      .from('ai_chat_conversations')
      .select('id, title, mode, messages, created_at, updated_at')
      .eq('user_id', session.user.id)
      .order('updated_at', { ascending: false })
      .limit(50)
      .then(({ data: rows, error: loadError }) => {
        if (loadError) throw loadError
        if (!active) return
        const loadedConversations = (rows || []).map((row) => ({
          ...row,
          messages: Array.isArray(row.messages)
            ? row.messages.filter((message) => (
              (message?.role === 'user' || message?.role === 'assistant')
              && typeof message.content === 'string'
            ))
            : [],
        }))
        setConversations((current) => {
          const byId = new Map(loadedConversations.map((conversation) => [conversation.id, conversation]))
          current.forEach((conversation) => byId.set(conversation.id, conversation))
          return [...byId.values()]
            .sort((first, second) => second.updated_at.localeCompare(first.updated_at))
            .slice(0, 50)
        })
      })
      .catch((loadError) => {
        if (active) setHistoryError(`Could not load chat history: ${loadError.message}`)
      })
      .finally(() => {
        if (active) setHistoryLoading(false)
      })

    return () => {
      active = false
    }
  }, [isOpen, session?.user?.id])

  useEffect(() => {
    if (!isOpen) return undefined

    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && !pending) onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [isOpen, onClose, pending])

  useEffect(() => {
    if (mode) inputRef.current?.focus()
  }, [mode])

  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight
    }
  }, [messages, pending])

  if (!isOpen) return null

  const persistConversation = async (id, title, selectedMode, nextMessages) => {
    const { data: saved, error: saveError } = await supabase
      .from('ai_chat_conversations')
      .upsert({
        id,
        user_id: session.user.id,
        title,
        mode: selectedMode,
        messages: nextMessages,
        updated_at: new Date().toISOString(),
      })
      .select('id, title, mode, messages, created_at, updated_at')
      .single()
    if (saveError) throw saveError

    setConversations((current) => [
      saved,
      ...current.filter((conversation) => conversation.id !== saved.id),
    ].slice(0, 50))
  }

  const ask = async (selectedMode, prompt) => {
    if (!session) {
      setError('Sign in to use AI with your app data.')
      return
    }
    if (!dataReady) {
      setError(dataError || 'Your app data is still loading. Please try again in a moment.')
      return
    }
    if (!supabase) {
      setError('Supabase is not configured. Add your Supabase URL and publishable key first.')
      return
    }

    const userMessage = prompt.trim()
    if (!userMessage || pending) return
    const nextMessages = [...messages, { role: 'user', content: userMessage }]
    const nextConversationId = conversationId || window.crypto.randomUUID()
    const existingConversation = conversations.find((conversation) => conversation.id === nextConversationId)
    const title = existingConversation?.title || (
      selectedMode === 'money' ? `${currentMonthLabel} money analysis`
        : selectedMode === 'trips' ? 'Trip analysis'
          : userMessage.slice(0, 60)
    )
    setMode(selectedMode)
    setMessages(nextMessages)
    setConversationId(nextConversationId)
    setDraft('')
    setError('')
    setPending(true)

    let assistantReplied = false
    try {
      await persistConversation(nextConversationId, title, selectedMode, nextMessages)
      const { data: result, error: invokeError } = await supabase.functions.invoke('ai-assistant', {
        body: {
          mode: selectedMode,
          messages: nextMessages.slice(-12),
          context: data(selectedMode, currentMonthKey),
        },
      })
      if (invokeError) {
        throw new Error(await getErrorMessage(invokeError))
      }
      if (typeof result?.reply !== 'string' || !result.reply.trim()) {
        throw new Error('The AI service returned an empty reply. Please try again.')
      }
      const completedMessages = [...nextMessages, { role: 'assistant', content: result.reply }]
      setMessages(completedMessages)
      assistantReplied = true
      await persistConversation(nextConversationId, title, selectedMode, completedMessages)
    } catch (requestError) {
      const message = await getErrorMessage(requestError)
      setError(assistantReplied ? `Your reply is shown, but chat history could not be saved: ${message}` : message)
    } finally {
      setPending(false)
    }
  }

  const submitMessage = (event) => {
    event.preventDefault()
    if (!mode) {
      setMode('chat')
      setMessages([])
    }
    ask(mode || 'chat', draft)
  }

  const startNewChat = () => {
    setMode('')
    setMessages([])
    setConversationId('')
    setDraft('')
    setError('')
  }

  const openConversation = (conversation) => {
    setConversationId(conversation.id)
    setMode(conversation.mode)
    setMessages(conversation.messages)
    setDraft('')
    setError('')
  }

  const beginRenameConversation = (event, conversation) => {
    event.stopPropagation()
    setEditingConversationId(conversation.id)
    setEditingConversationTitle(conversation.title)
    setError('')
  }

  const renameConversation = async (event, conversation) => {
    event.preventDefault()
    event.stopPropagation()
    const title = editingConversationTitle.trim()
    if (!title) {
      setError('Chat title cannot be empty.')
      return
    }

    setHistoryActionId(conversation.id)
    setError('')
    try {
      const { data: updated, error: updateError } = await supabase
        .from('ai_chat_conversations')
        .update({ title, updated_at: new Date().toISOString() })
        .eq('id', conversation.id)
        .eq('user_id', session.user.id)
        .select('id, title, mode, messages, created_at, updated_at')
        .single()
      if (updateError) throw updateError

      setConversations((current) => current.map((item) => item.id === updated.id ? { ...item, ...updated } : item))
      setEditingConversationId('')
      setEditingConversationTitle('')
    } catch (renameError) {
      setError(`Could not rename this chat: ${renameError.message}`)
    } finally {
      setHistoryActionId('')
    }
  }

  const deleteConversation = async (event, conversation) => {
    event.stopPropagation()
    if (!await confirmAction({
      title: 'Delete this chat?',
      message: `Delete "${conversation.title}" and its messages? This cannot be undone.`,
    })) return

    setHistoryActionId(conversation.id)
    setError('')
    try {
      const { error: deleteError } = await supabase
        .from('ai_chat_conversations')
        .delete()
        .eq('id', conversation.id)
        .eq('user_id', session.user.id)
      if (deleteError) throw deleteError

      setConversations((current) => current.filter((item) => item.id !== conversation.id))
      if (conversationId === conversation.id) {
        setConversationId('')
        setMode('')
        setMessages([])
        setDraft('')
      }
    } catch (deleteError) {
      setError(`Could not delete this chat: ${deleteError.message}`)
    } finally {
      setHistoryActionId('')
    }
  }

  const copyMessage = async (content, index) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is unavailable in this browser.')
      await navigator.clipboard.writeText(content)
      setCopiedMessageIndex(index)
      setError('')
    } catch (copyError) {
      setError(`Could not copy this response: ${copyError.message}`)
    }
  }

  return (
    <div className="ai-chat-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !pending) onClose()
    }}>
      <section className="ai-chat-window" role="dialog" aria-modal="true" aria-labelledby="ai-chat-title">
        <header className="ai-chat-header">
          <div className="ai-chat-brand"><span className="ai-chat-mark">✦</span><div><h2 id="ai-chat-title">Josaki AI</h2><p>Thoughtful insights from your workspace</p></div></div>
          <div className="ai-chat-header-actions">
            {mode && <button type="button" className="ai-chat-new" onClick={startNewChat} disabled={pending}>New chat</button>}
            <button type="button" className="ai-chat-close" aria-label="Close AI chat" onClick={onClose}><span aria-hidden="true">×</span></button>
          </div>
        </header>

        <div className="ai-chat-content" ref={messageListRef} aria-live="polite">
          {!mode ? <div className="ai-chat-welcome">
            <span className="ai-chat-eyebrow">YOUR PERSONAL INSIGHT SPACE</span>
            <h3>What would you like to explore?</h3>
            <p>Choose an analysis or ask a question about the information in your app.</p>
            <div className="ai-quick-actions">
              {quickActions.map((action) => <button
                type="button"
                className="ai-quick-action"
                key={action.mode}
                onClick={() => ask(action.mode, action.prompt)}
                disabled={!session || !dataReady || pending}
              >
                <span className="ai-quick-icon">{action.icon}</span>
                <span><strong>{action.title}</strong><small>{action.description}</small></span>
                <span className="ai-quick-arrow" aria-hidden="true">→</span>
              </button>)}
              <button
                type="button"
                className="ai-quick-action ai-open-chat"
                onClick={() => { setMode('chat'); setError('') }}
                disabled={!session || !dataReady}
              >
                <span className="ai-quick-icon"><span aria-hidden="true">↗</span></span>
                <span><strong>Chat with AI</strong><small>Ask anything about your current goals, money, trips and more.</small></span>
                <span className="ai-quick-arrow" aria-hidden="true">→</span>
              </button>
            </div>
            <section className="ai-chat-history" aria-labelledby="ai-chat-history-title">
              <h4 id="ai-chat-history-title">Recent chats</h4>
              {historyLoading && <p className="ai-chat-history-status" role="status">Loading chat history…</p>}
              {historyError && <p className="ai-chat-history-error" role="alert">{historyError}</p>}
              {!historyLoading && !historyError && conversations.length === 0 && <p className="ai-chat-history-status">Your saved conversations will appear here.</p>}
              {conversations.map((conversation) => (
                <div className="ai-chat-history-item" key={conversation.id}>
                  {editingConversationId === conversation.id
                    ? <form className="ai-chat-rename-form" onSubmit={(event) => renameConversation(event, conversation)}>
                      <input
                        autoFocus
                        value={editingConversationTitle}
                        onChange={(event) => setEditingConversationTitle(event.target.value)}
                        maxLength={100}
                        aria-label="Chat title"
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') {
                            setEditingConversationId('')
                            setEditingConversationTitle('')
                          }
                        }}
                      />
                      <button type="submit" className="ai-chat-history-action" disabled={!editingConversationTitle.trim() || historyActionId === conversation.id}>Save</button>
                      <button type="button" className="ai-chat-history-action" onClick={() => { setEditingConversationId(''); setEditingConversationTitle('') }}>Cancel</button>
                    </form>
                    : <>
                      <button
                        type="button"
                        className="ai-chat-history-open"
                        onClick={() => openConversation(conversation)}
                      >
                        <span>{conversation.title}</span>
                        <small>{new Date(conversation.updated_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</small>
                      </button>
                      <div className="ai-chat-history-actions">
                        <button type="button" className="ai-chat-history-action" onClick={(event) => beginRenameConversation(event, conversation)} disabled={historyActionId === conversation.id}>Rename</button>
                        <button type="button" className="ai-chat-history-action ai-chat-delete" onClick={(event) => deleteConversation(event, conversation)} disabled={historyActionId === conversation.id}>Delete</button>
                      </div>
                    </>}
                </div>
              ))}
            </section>
          </div> : <div className="ai-chat-messages">
            {!messages.length && <div className="ai-message ai-message-assistant"><strong>Josaki AI</strong><p>Hi! Ask me about your current app data, or tell me what you’d like help thinking through.</p></div>}
            {messages.map((message, index) => <article className={`ai-message ai-message-${message.role}`} key={`${index}-${message.role}`}>
              {message.role === 'assistant' && <div className="ai-message-toolbar">
                <strong>Josaki AI</strong>
                <button type="button" className="ai-copy-button" onClick={() => copyMessage(message.content, index)} aria-label={copiedMessageIndex === index ? 'Response copied' : 'Copy response'}>
                  {copiedMessageIndex === index ? 'Copied' : 'Copy'}
                </button>
              </div>}
              <div className="ai-message-text">{message.role === 'assistant' ? formatAssistantText(message.content) : <p>{message.content}</p>}</div>
            </article>)}
            {pending && <div className="ai-message ai-message-assistant ai-thinking" role="status"><span className="ai-thinking-dots" />Analyzing your data…</div>}
          </div>}
        </div>

        {error && <p className="ai-chat-error" role="alert">{error}</p>}
        {!session && <p className="ai-chat-hint">Sign in to ask AI about your workspace.</p>}
        {session && !dataReady && <p className="ai-chat-hint">{dataError || 'Loading your workspace data…'}</p>}
        <p className="ai-chat-privacy">Your private app data is only sent when you ask. Files and attachments are excluded.</p>

        {mode && <form className="ai-chat-composer" onSubmit={submitMessage}>
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                event.currentTarget.form.requestSubmit()
              }
            }}
            maxLength={3000}
            rows={2}
            placeholder="Message Josaki AI…"
            aria-label="Message AI"
            disabled={!session || !dataReady || pending}
          />
          <button type="submit" className="ai-chat-send" aria-label="Send message" disabled={!draft.trim() || !session || !dataReady || pending}><span aria-hidden="true">↑</span></button>
          <span className="ai-chat-composer-hint">Enter to send · Shift+Enter for a new line</span>
        </form>}
        {!mode && <div className="ai-chat-footer"><span>Responses are AI-generated. Check important numbers before making decisions.</span></div>}
      </section>
    </div>
  )
}
