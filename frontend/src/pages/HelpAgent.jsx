import { useState, useRef, useEffect, useCallback } from 'react'
import { MessageCircle, X, Send, Zap, ChevronDown, RotateCcw } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { helpApi } from '../api'

const QUICK_PROMPTS = [
  "How does Job Discovery work?",
  "How do I track an application?",
  "How do I add interview rounds?",
  "What does the Coach feature do?",
  "How do I connect Gmail?",
  "Where do I see upcoming interviews?",
  "What should I do next?",
]

const PAGE_LABELS = {
  '/': 'Dashboard',
  '/tracker': 'Job Tracker',
  '/discovery': 'Job Discovery',
  '/coach': 'AI Coach',
  '/calendar': 'Calendar',
  '/events': 'Local Events',
  '/news': 'Industry News',
  '/networking': 'Networking',
  '/profile': 'Profile',
}

export default function HelpAgent() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const location = useLocation()

  const currentPage = PAGE_LABELS[location.pathname] || 'RecruitIQ'

  useEffect(() => {
    if (open) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [messages, open])

  const sendMessage = useCallback(async (text) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return
    setMessages(prev => [...prev, { role: 'user', content: trimmed }])
    setInput('')
    setLoading(true)
    try {
      const res = await helpApi.chat({ message: trimmed, context: { page: currentPage } })
      const reply = res.data?.reply || "Sorry, I couldn't process that. Please try again."
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: "I'm having trouble connecting right now. Please try again in a moment." }])
    } finally {
      setLoading(false)
    }
  }, [loading, currentPage])

  const handleSubmit = (e) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleReset = () => {
    setMessages([])
    setInput('')
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-xl hover:shadow-2xl active:scale-95 transition-all flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)' }}
        title="Orion Assistant"
        aria-label={open ? 'Close assistant' : 'Open Orion Assistant'}
      >
        <div className="relative">
          {open ? <X size={22} className="text-white" /> : <MessageCircle size={22} className="text-white" />}
          {!open && messages.length === 0 && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white" />
          )}
        </div>
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-navy-100 flex flex-col overflow-hidden"
          style={{ maxHeight: '540px' }}
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 shrink-0" style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)' }}>
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
              <Zap size={15} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Orion Assistant</p>
              <p className="text-[11px] text-violet-200 truncate">On: {currentPage}</p>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={handleReset}
                  className="p-1.5 rounded-lg hover:bg-white/20 transition-colors text-violet-200 hover:text-white"
                  title="Clear conversation"
                >
                  <RotateCcw size={13} />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors text-violet-200 hover:text-white"
              >
                <ChevronDown size={16} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]" style={{ maxHeight: '380px' }}>
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Zap size={12} className="text-violet-600" />
                  </div>
                  <div className="bg-navy-50 border border-navy-100 rounded-2xl rounded-tl-sm px-3 py-2.5 text-sm text-navy-700 leading-relaxed">
                    Hi! I can help you navigate Orion and get the most out of your job search. What would you like to know?
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 pl-9">
                  {QUICK_PROMPTS.map(p => (
                    <button
                      key={p}
                      onClick={() => sendMessage(p)}
                      className="text-xs px-2.5 py-1.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 transition-colors text-left"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex items-start gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Zap size={12} className="text-violet-600" />
                  </div>
                )}
                <div
                  className={`max-w-[82%] px-3 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-violet-600 text-white rounded-tr-sm'
                      : 'bg-navy-50 text-navy-800 border border-navy-100 rounded-tl-sm'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-start gap-2 justify-start">
                <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Zap size={12} className="text-violet-600" />
                </div>
                <div className="bg-navy-50 border border-navy-100 rounded-2xl rounded-tl-sm px-3 py-2.5 flex gap-1 items-center">
                  <span className="w-2 h-2 rounded-full bg-navy-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-navy-300 animate-bounce" style={{ animationDelay: '160ms' }} />
                  <span className="w-2 h-2 rounded-full bg-navy-300 animate-bounce" style={{ animationDelay: '320ms' }} />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="flex items-center gap-2 px-3 py-3 border-t border-navy-100 shrink-0">
            <input
              ref={inputRef}
              className="flex-1 text-sm px-3 py-2 rounded-full border border-navy-200 bg-slate-50 text-navy-800 placeholder-navy-400 outline-none focus:border-violet-400 focus:bg-white transition-colors"
              placeholder="Ask anything…"
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-40 transition-colors"
              style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)' }}
            >
              <Send size={14} className="text-white" />
            </button>
          </form>
        </div>
      )}
    </>
  )
}
