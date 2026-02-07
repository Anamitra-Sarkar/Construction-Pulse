'use client'

import { useEffect, useState } from 'react'

interface ChartWrapperProps {
  children: React.ReactNode
  minHeight?: string
  loading?: boolean
}

/**
 * Wrapper component for charts to ensure they render only on client-side
 * and have proper dimensions. Prevents "width(-1) and height(-1)" errors.
 */
export function ChartWrapper({ 
  children, 
  minHeight = 'min-h-[220px]',
  loading = false 
}: ChartWrapperProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className={`w-full ${minHeight} flex items-center justify-center`}>
      {!mounted || loading ? (
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-sm text-slate-500">Loading chart...</p>
        </div>
      ) : (
        children
      )}
    </div>
  )
}
