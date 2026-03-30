import { useState } from 'react'

// Archer mark — just the figure, no ORION text (avatars, login, register, chat)
export default function OrionMark({ className = 'w-8 h-8', light = false }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <div className={`${className} rounded-lg flex items-center justify-center shrink-0 ${light ? 'bg-white/20' : 'bg-navy-100'}`}>
        <span className={`font-bold text-sm leading-none ${light ? 'text-white' : 'text-navy-700'}`}>O</span>
      </div>
    )
  }
  return (
    <img
      src="/orion-logo.png"
      alt="Orion"
      className={`${className} object-contain shrink-0 ${light ? 'brightness-0 invert' : ''}`}
      onError={() => setFailed(true)}
    />
  )
}

// Full logo — archer + ORION text (sidebar header)
export function OrionLogo({ className = 'h-16 w-auto', light = false }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
          <span className="text-white font-bold text-sm">O</span>
        </div>
        <span className={`font-bold text-lg tracking-widest ${light ? 'text-white' : 'text-navy-900'}`}>ORION</span>
      </div>
    )
  }
  return (
    <img
      src="/orion-logo.png"
      alt="Orion"
      className={`${className} object-contain shrink-0 ${light ? 'brightness-0 invert' : ''}`}
      onError={() => setFailed(true)}
    />
  )
}
