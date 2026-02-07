'use client'

import { useEffect, useState } from 'react'

export function AnimatedBackground() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    // Check for reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    // Allow disabling via environment variable
    const shouldRender = process.env.NEXT_PUBLIC_RENDER_ANIMATION !== 'false'
    setEnabled(shouldRender)
  }, [])

  if (!enabled || prefersReducedMotion) {
    return null
  }

  return (
    <div 
      className="fixed inset-0 -z-10 pointer-events-none opacity-[0.04]"
      aria-hidden="true"
    >
      <svg
        className="absolute inset-0 w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="construction-grid"
            x="0"
            y="0"
            width="100"
            height="100"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="50" cy="50" r="2" fill="#2563eb" className="animate-pulse" style={{ animationDuration: '4s' }} />
            <circle cx="25" cy="75" r="1.5" fill="#3b82f6" className="animate-pulse" style={{ animationDuration: '3s', animationDelay: '0.5s' }} />
            <circle cx="75" cy="25" r="1.5" fill="#60a5fa" className="animate-pulse" style={{ animationDuration: '3.5s', animationDelay: '1s' }} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#construction-grid)" />
      </svg>
      
      {/* Subtle construction crane silhouette */}
      <div className="absolute top-10 right-20 w-32 h-32 opacity-30 animate-subtle-float">
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M50 10 L50 70" stroke="#2563eb" strokeWidth="2" />
          <path d="M50 15 L80 15 L80 65" stroke="#2563eb" strokeWidth="1.5" />
          <path d="M50 15 L20 15" stroke="#2563eb" strokeWidth="1.5" />
          <circle cx="80" cy="65" r="3" fill="#3b82f6" />
        </svg>
      </div>
    </div>
  )
}
