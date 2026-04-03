import { useState, useEffect, useCallback, Component } from 'react'
import {
  Newspaper, RefreshCw, ExternalLink, Clock, Tag,
  TrendingUp, Sparkles, AlertCircle,
} from 'lucide-react'
import { newsApi } from '../api'
import { timeAgo as _timeAgo } from '../utils/dates'

// ── Topic filter config ───────────────────────────────────────────────────────
const TOPICS = [
  { id: 'all',         label: 'All',         icon: TrendingUp,  active: 'bg-navy-800 text-white border-navy-800',         inactive: 'bg-white text-navy-600 border-navy-200 hover:bg-navy-50' },
  { id: 'funding',     label: 'Funding',     icon: Sparkles,         active: 'bg-emerald-600 text-white border-emerald-600',   inactive: 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50' },
  { id: 'hiring',      label: 'Hiring',      icon: Tag,         active: 'bg-sky-600 text-white border-sky-600',           inactive: 'bg-white text-sky-700 border-sky-200 hover:bg-sky-50' },
  { id: 'ai_research', label: 'AI Research', icon: Sparkles,         active: 'bg-violet-DEFAULT text-white border-violet-DEFAULT', inactive: 'bg-white text-violet-700 border-violet-200 hover:bg-violet-50' },
  { id: 'products',    label: 'Products',    icon: Tag,         active: 'bg-amber-500 text-white border-amber-500',       inactive: 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50' },
  { id: 'policy',      label: 'Policy',      icon: AlertCircle, active: 'bg-rose-600 text-white border-rose-600',         inactive: 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50' },
]

// Topic chip colors for article cards (not filter buttons)
const TOPIC_CHIP = {
  funding:     'bg-emerald-50 text-emerald-700 border border-emerald-200',
  hiring:      'bg-sky-50 text-sky-700 border border-sky-200',
  ai_research: 'bg-violet-light/60 text-violet-dark border border-violet-light',
  products:    'bg-amber-50 text-amber-700 border border-amber-200',
  policy:      'bg-rose-50 text-rose-700 border border-rose-200',
}

const TOPIC_LABEL = {
  funding:     'Funding',
  hiring:      'Hiring',
  ai_research: 'AI Research',
  products:    'Products',
  policy:      'Policy',
}

// ── Time formatting ───────────────────────────────────────────────────────────
function timeAgo(isoStr) { return _timeAgo(isoStr) }

// ── Source initials fallback ──────────────────────────────────────────────────
function sourceInitials(source) {
  if (!source) return '?'
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')
}

// Gradient based on source name for fallback image backgrounds
function sourceFallbackGradient(source) {
  const gradients = [
    'from-violet-medium to-violet-dark',
    'from-navy-600 to-navy-800',
    'from-emerald-600 to-emerald-800',
    'from-sky-500 to-sky-700',
    'from-rose-500 to-rose-700',
    'from-amber-500 to-amber-700',
    'from-slate-500 to-slate-700',
  ]
  const idx = (source || '').charCodeAt(0) % gradients.length
  return gradients[idx]
}

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="card overflow-hidden animate-pulse">
      <div className="h-36 bg-navy-100" />
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-5 w-20 bg-navy-100 rounded-full" />
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-navy-100 rounded w-full" />
          <div className="h-4 bg-navy-100 rounded w-4/5" />
        </div>
        <div className="h-3 bg-navy-100 rounded w-full" />
        <div className="h-3 bg-navy-100 rounded w-3/4" />
        <div className="flex items-center justify-between pt-1">
          <div className="h-3 w-14 bg-navy-100 rounded" />
          <div className="h-3 w-16 bg-navy-100 rounded" />
        </div>
      </div>
    </div>
  )
}

// ── Article card ──────────────────────────────────────────────────────────────
function ArticleCard({ article }) {
  const {
    title, url, source, source_color, description,
    image, published_at, topics = [],
  } = article

  const ago        = timeAgo(published_at)
  const initials   = sourceInitials(source)
  const gradient   = sourceFallbackGradient(source)
  const hasImage   = Boolean(image)

  // source_color comes from backend like "bg-green-100 text-green-700"
  const badgeClass = source_color || 'bg-slate-100 text-slate-700'

  return (
    <article className="card overflow-hidden flex flex-col hover:shadow-matte-md transition-shadow duration-200 group">
      {/* Image / Fallback */}
      <div className="relative h-36 shrink-0 overflow-hidden">
        {hasImage ? (
          <img
            src={image}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex' }}
          />
        ) : null}
        {/* Fallback gradient (always rendered, hidden when image loads successfully) */}
        <div
          className={`absolute inset-0 bg-gradient-to-br ${gradient} flex items-center justify-center ${hasImage ? 'hidden' : 'flex'}`}
          style={hasImage ? { display: 'none' } : {}}
        >
          <span className="text-white text-2xl font-bold opacity-40 select-none">{initials}</span>
        </div>
        {/* Source badge overlaid on image */}
        <div className="absolute top-2 left-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shadow-sm ${badgeClass}`}>
            {source}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-4 gap-2">
        {/* Title */}
        <h3 className="text-sm font-semibold text-navy-800 leading-snug line-clamp-2 group-hover:text-violet-DEFAULT transition-colors duration-150">
          {title}
        </h3>

        {/* Description */}
        {description && (
          <p className="text-xs text-navy-500 leading-relaxed line-clamp-2 flex-1">
            {description}
          </p>
        )}

        {/* Topic chips */}
        {topics.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {topics.slice(0, 3).map(t => (
              <span key={t} className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${TOPIC_CHIP[t] || 'bg-slate-50 text-slate-600 border border-slate-200'}`}>
                {TOPIC_LABEL[t] || t}
              </span>
            ))}
          </div>
        )}

        {/* Footer row */}
        <div className="flex items-center justify-between pt-1 mt-auto">
          <div className="flex items-center gap-1 text-xs text-navy-400">
            {ago && (
              <>
                <Clock size={11} />
                <span>{ago}</span>
              </>
            )}
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-violet-DEFAULT hover:text-violet-dark transition-colors duration-150"
            onClick={e => e.stopPropagation()}
          >
            Read
            <ExternalLink size={11} />
          </a>
        </div>
      </div>
    </article>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ topic, onClear }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-navy-50 flex items-center justify-center mb-4">
        <Newspaper size={24} className="text-navy-300" />
      </div>
      <p className="text-navy-600 font-medium">No articles found</p>
      <p className="text-navy-400 text-sm mt-1">
        {topic !== 'all'
          ? `No "${TOPIC_LABEL[topic] || topic}" articles in the current feed.`
          : 'The news feed could not be loaded.'}
      </p>
      {topic !== 'all' && (
        <button onClick={onClear} className="btn-secondary mt-4 text-xs px-3 py-1.5">
          Show all articles
        </button>
      )}
    </div>
  )
}

// ── Error Boundary ───────────────────────────────────────────────────────────
class NewsErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false } }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(err) { console.error('[News] Render error:', err) }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-12 text-center">
          <p className="text-lg font-semibold text-navy-800">Something went wrong</p>
          <p className="text-sm text-navy-400 mt-2">Try refreshing the page</p>
          <button onClick={() => window.location.reload()} className="btn-primary mt-4">Refresh</button>
        </div>
      )
    }
    return this.props.children
  }
}

// ── Main News page ────────────────────────────────────────────────────────────
export default function News() {
  const [articles, setArticles]       = useState([])
  const [total, setTotal]             = useState(0)
  const [loading, setLoading]         = useState(true)
  const [refreshing, setRefreshing]   = useState(false)
  const [error, setError]             = useState(null)
  const [activeTopic, setActiveTopic] = useState('all')
  const [fetchedAt, setFetchedAt]     = useState(null)

  const loadNews = useCallback(async (topic = 'all') => {
    setLoading(true)
    setError(null)
    try {
      const res = await newsApi.getAll(topic !== 'all' ? { topic } : {})
      setArticles(res.data.articles || [])
      setTotal(res.data.total || 0)
      setFetchedAt(new Date())
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to load news. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    setError(null)
    try {
      const res = await newsApi.refresh()
      const all = res.data.articles || []
      // Apply active topic filter client-side after refresh
      const filtered = activeTopic !== 'all'
        ? all.filter(a => (a.topics || []).includes(activeTopic))
        : all
      setArticles(filtered)
      setTotal(res.data.total || 0)
      setFetchedAt(new Date())
    } catch (err) {
      setError(err?.response?.data?.detail || 'Refresh failed. Please try again.')
    } finally {
      setRefreshing(false)
    }
  }, [activeTopic])

  const handleTopicChange = useCallback((topicId) => {
    setActiveTopic(topicId)
    loadNews(topicId)
  }, [loadNews])

  useEffect(() => {
    loadNews('all')
  }, []) // eslint-disable-line

  const fetchedLabel = fetchedAt
    ? `Updated ${timeAgo(fetchedAt.toISOString())}`
    : ''

  const skeletonCount = 9

  return (
    <NewsErrorBoundary>
    <div className="p-6 max-w-[1400px] mx-auto">

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-DEFAULT/10 flex items-center justify-center shrink-0 mt-0.5">
            <Newspaper size={20} className="text-violet-DEFAULT" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-navy-900">AI &amp; Startup News</h1>
            <p className="text-sm text-navy-400 mt-0.5">
              Stay sharp on the latest developments before your interviews
            </p>
          </div>
        </div>

        {/* Refresh button + last-fetched time */}
        <div className="flex items-center gap-3 shrink-0">
          {fetchedLabel && !loading && (
            <span className="text-xs text-navy-400 flex items-center gap-1">
              <Clock size={11} />
              {fetchedLabel}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="btn-secondary text-xs px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* ── Topic filter chips ── */}
      <div className="flex items-center gap-2 flex-wrap mb-6">
        {TOPICS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => handleTopicChange(id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 ${
              activeTopic === id ? TOPICS.find(t => t.id === id).active : TOPICS.find(t => t.id === id).inactive
            }`}
          >
            {label}
          </button>
        ))}
        {total > 0 && !loading && (
          <span className="ml-1 text-xs text-navy-400">
            {total} article{total !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="flex items-start gap-2 p-4 mb-6 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Article grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: skeletonCount }).map((_, i) => <SkeletonCard key={i} />)
        ) : articles.length === 0 ? (
          <EmptyState topic={activeTopic} onClear={() => handleTopicChange('all')} />
        ) : (
          articles.map((article, i) => (
            <ArticleCard key={`${article.url}-${i}`} article={article} />
          ))
        )}
      </div>
    </div>
    </NewsErrorBoundary>
  )
}
