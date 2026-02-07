'use client'

import { useEffect, useState } from 'react'

export type EmojiState = 'idle' | 'loading' | 'success' | 'failure'

interface EmojiStatusProps {
  state: EmojiState
  className?: string
}

const EMOJI_MAP: Record<EmojiState, string> = {
  idle: '😐',
  loading: '🤔',
  success: '😄',
  failure: '😞'
}

const STATE_LABELS: Record<EmojiState, string> = {
  idle: 'Ready to sign in',
  loading: 'Signing in...',
  success: 'Sign in successful!',
  failure: 'Sign in failed'
}

export function EmojiStatus({ state, className = '' }: EmojiStatusProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className={`text-4xl ${className}`}>😐</div>
  }

  return (
    <div 
      className={`text-4xl transition-all duration-300 ${className} ${
        state === 'loading' ? 'animate-pulse' : ''
      }`}
      role="img"
      aria-label={STATE_LABELS[state]}
      aria-live="polite"
    >
      {EMOJI_MAP[state]}
    </div>
  )
}
