import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authApi } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [token, setToken]     = useState(() => localStorage.getItem('orion_token'))
  const [loading, setLoading] = useState(true)   // checking stored token

  // On mount, verify stored token
  useEffect(() => {
    if (!token) { setLoading(false); return }
    authApi.me()
      .then(res => setUser(res.data))
      .catch(() => { localStorage.removeItem('orion_token'); setToken(null) })
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line

  const _persist = (tok, usr) => {
    localStorage.setItem('orion_token', tok)
    localStorage.setItem('orion_user', JSON.stringify(usr))
    setToken(tok)
    setUser(usr)
  }

  const login = useCallback(async (email, password) => {
    const res = await authApi.login({ email, password })
    _persist(res.data.token, res.data.user)
    return res.data.user
  }, [])

  const register = useCallback(async (payload) => {
    const res = await authApi.register(payload)
    _persist(res.data.token, res.data.user)
    return res.data.user
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('orion_token')
    localStorage.removeItem('orion_user')
    setToken(null)
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const res = await authApi.me()
      setUser(res.data)
      return res.data
    } catch { return null }
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
