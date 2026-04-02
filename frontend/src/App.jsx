import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Briefcase, Search, Loader2, User, LogOut, CalendarDays, GraduationCap, MapPin, Newspaper,
} from 'lucide-react'
import { AuthProvider, useAuth } from './context/AuthContext'
import Dashboard    from './pages/Dashboard'
import JobTracker   from './pages/JobTracker'
import JobDiscovery from './pages/JobDiscovery'
import Calendar     from './pages/Calendar'
import Coach        from './pages/Coach'
import Networking   from './pages/Networking'
import Profile      from './pages/Profile'
import Events       from './pages/Events'
import News         from './pages/News'
import Login        from './pages/Login'
import Register     from './pages/Register'
import Privacy      from './pages/Privacy'
import Terms        from './pages/Terms'
import Landing      from './pages/Landing'
import HelpAgent    from './pages/HelpAgent'
import OrionMark from './components/OrionMark'

const NAV_ITEMS = [
  { to: '/',            label: 'Dashboard',     icon: LayoutDashboard },
  { to: '/tracker',     label: 'Job Tracker',   icon: Briefcase },
  { to: '/discovery',   label: 'Job Discovery', icon: Search },
  { to: '/coach',       label: 'Coach',         icon: GraduationCap },
  { to: '/calendar',    label: 'Calendar',      icon: CalendarDays },
  { to: '/events',      label: 'Events',        icon: MapPin },
  { to: '/news',        label: 'News',          icon: Newspaper },
]

function Sidebar() {
  const { user, logout } = useAuth()

  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-navy-900 flex flex-col z-30 shadow-matte-lg">
      {/* Logo */}
      <div className="px-4 pt-6 pb-2">
        <OrionMark className="w-24 h-24" light />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-violet-DEFAULT text-white shadow-matte'
                  : 'text-navy-300 hover:text-white hover:bg-navy-800'
              }`
            }
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer: profile + logout + user info */}
      <div className="px-3 pb-4 border-t border-navy-800 pt-3 space-y-1">
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
              isActive ? 'bg-violet-DEFAULT text-white' : 'text-navy-300 hover:text-white hover:bg-navy-800'
            }`
          }
        >
          <User size={17} />
          Profile
        </NavLink>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-navy-400 hover:text-red-400 hover:bg-red-950/20 transition-all duration-150"
        >
          <LogOut size={17} />
          Sign Out
        </button>

        <div className="px-3 pt-2">
          {user && (
            <p className="text-navy-300 text-sm font-medium truncate">{user.name.split(' ')[0]}</p>
          )}
          {user?.university && (
            <p className="text-navy-500 text-xs truncate">{user.university}</p>
          )}
          {user?.graduation_year && (
            <p className="text-navy-600 text-xs">Class of {user.graduation_year}</p>
          )}
        </div>
      </div>
    </aside>
  )
}

function ProtectedLayout({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-navy-400">
          <Loader2 size={20} className="text-violet-DEFAULT animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 ml-56 min-h-screen">
        {children}
      </main>
      <HelpAgent />
    </div>
  )
}

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-navy-400">
          <Loader2 size={20} className="text-violet-DEFAULT animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login"    element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/dashboard" replace /> : <Register />} />
      <Route path="/privacy"  element={<Privacy />} />
      <Route path="/terms"    element={<Terms />} />

      {/* Landing page for unauthenticated users */}
      <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Landing />} />

      {/* Protected routes */}
      <Route path="/*" element={
        <ProtectedLayout>
          <Routes>
            <Route path="/dashboard"   element={<Dashboard />} />
            <Route path="/tracker"     element={<JobTracker />} />
            <Route path="/discovery"   element={<JobDiscovery />} />
            <Route path="/calendar"    element={<Calendar />} />
            <Route path="/events"      element={<Events />} />
            <Route path="/networking"  element={<Networking />} />
            <Route path="/coach"       element={<Coach />} />
            <Route path="/news"        element={<News />} />
            <Route path="/profile"     element={<Profile />} />
          </Routes>
        </ProtectedLayout>
      } />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
