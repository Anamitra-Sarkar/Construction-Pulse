'use client'

import { cn } from '@/lib/utils'

interface SectionHeadingProps {
  children: React.ReactNode
  className?: string
  subtitle?: string
  as?: 'h1' | 'h2' | 'h3'
}

export function SectionHeading({ 
  children, 
  className, 
  subtitle,
  as: Component = 'h1' 
}: SectionHeadingProps) {
  return (
    <div className="mb-6">
      <Component 
        className={cn(
          "heading-glow text-2xl font-bold tracking-tight",
          className
        )}
      >
        {children}
      </Component>
      {subtitle && (
        <p className="text-slate-500 mt-2 text-sm">{subtitle}</p>
      )}
    </div>
  )
}
