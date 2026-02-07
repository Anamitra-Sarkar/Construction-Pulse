'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { format } from 'date-fns'
import { AnimatedBackground } from '@/components/AnimatedBackground'

const adminNavItems = [
  { href: '/admin', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href: '/admin/sites', label: 'Sites', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
  { href: '/admin/users', label: 'Users', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  { href: '/admin/reports', label: 'Reports', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { href: '/admin/analytics', label: 'Analytics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { href: '/admin/audit', label: 'Audit Log', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
]

const engineerNavItems = [
  { href: '/engineer', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href: '/engineer/sites', label: 'My Sites', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
  { href: '/engineer/reports', label: 'My Reports', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { href: '/engineer/new-report', label: 'New Report', icon: 'M12 4v16m8-8H4' },
]

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, notifications, unreadCount, markNotificationsRead } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [showNotifications, setShowNotifications] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false) // Mobile menu state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false) // Desktop collapse state
  
  // Load collapsed state from localStorage on mount
  useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ui.sidebarCollapsed')
      if (saved !== null) {
        setSidebarCollapsed(saved === 'true')
      }
    }
  })
  
  // Toggle sidebar collapse and persist to localStorage
  const toggleSidebarCollapse = () => {
    const newState = !sidebarCollapsed
    setSidebarCollapsed(newState)
    if (typeof window !== 'undefined') {
      localStorage.setItem('ui.sidebarCollapsed', String(newState))
    }
  }
  
  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggleSidebarCollapse()
    }
  }

  const navItems = user?.role === 'admin' ? adminNavItems : engineerNavItems

  return (
    <div className="min-h-screen bg-background relative">
      {/* Background Animation */}
      <AnimatedBackground />
      
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md border-b border-border/40 z-30 flex items-center px-4">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2.5 rounded-xl hover:bg-slate-100 transition-colors active:scale-95"
          aria-label="Toggle mobile menu"
        >
          <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="ml-4 font-bold text-slate-900 tracking-tight">Quality Pulse</span>
      </div>
      
      {/* Desktop Toggle Button - Top Left */}
      <button
        onClick={toggleSidebarCollapse}
        onKeyDown={handleKeyDown}
        className="hidden lg:flex fixed top-4 left-4 z-50 p-2.5 rounded-xl bg-white/90 backdrop-blur-md border border-border/40 hover:bg-slate-50 transition-all duration-300 active:scale-95 shadow-soft"
        style={{ 
          left: sidebarCollapsed ? '1rem' : 'calc(16rem + 1rem)',
          transition: 'left 300ms cubic-bezier(0.4, 0, 0.2, 1)'
        }}
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-expanded={!sidebarCollapsed}
        tabIndex={0}
      >
        <svg 
          className={cn(
            "w-5 h-5 text-slate-600 transition-transform duration-300",
            sidebarCollapsed ? "" : "rotate-180"
          )} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
        </svg>
      </button>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 z-40 h-full bg-white/90 backdrop-blur-xl border-r border-border/40 transform transition-all duration-300 ease-soft",
        // Mobile behavior
        "lg:translate-x-0",
        sidebarOpen ? "translate-x-0 shadow-2xl w-64" : "-translate-x-full",
        // Desktop behavior
        sidebarCollapsed ? "lg:w-20" : "lg:w-64"
      )}>
        <div className="flex flex-col h-full bg-fabric">
          <div className="h-16 flex items-center px-6 border-b border-border/40">
            <div className={cn(
              "flex items-center gap-3 transition-all duration-300",
              sidebarCollapsed && "lg:justify-center lg:px-0"
            )}>
              <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center shadow-soft shrink-0">
                <svg className="w-5 h-5 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              {!sidebarCollapsed && (
                <span className="font-bold text-slate-900 tracking-tight lg:block hidden">Quality Pulse</span>
              )}
              <span className="font-bold text-slate-900 tracking-tight lg:hidden">Quality Pulse</span>
            </div>
          </div>

          <nav className="flex-1 px-4 py-8 space-y-1.5 overflow-y-auto">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ease-soft",
                  pathname === item.href
                    ? "bg-primary/5 text-primary shadow-[inset_0_0_0_1px_rgba(var(--primary),0.1)]"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
                  sidebarCollapsed && "lg:justify-center lg:px-3"
                )}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <svg className={cn(
                  "w-5 h-5 transition-transform duration-300 shrink-0",
                  pathname === item.href ? "scale-110" : "group-hover:scale-110"
                )} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={pathname === item.href ? 2.5 : 2} d={item.icon} />
                </svg>
                {!sidebarCollapsed && (
                  <span className="lg:block hidden">{item.label}</span>
                )}
                <span className="lg:hidden">{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="p-4 border-t border-border/40">
            <div className={cn(
              "flex items-center gap-3 px-4 py-3 bg-white/50 rounded-2xl border border-border/40 shadow-soft mb-2",
              sidebarCollapsed && "lg:justify-center lg:px-2"
            )}>
              <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center border border-primary/20 shrink-0">
                <span className="text-sm font-bold text-primary">
                  {user?.name?.charAt(0).toUpperCase()}
                </span>
              </div>
              {!sidebarCollapsed && (
                <div className="flex-1 min-w-0 lg:block hidden">
                  <p className="text-sm font-bold text-slate-900 truncate tracking-tight">{user?.name}</p>
                  <p className="text-[10px] text-primary font-bold uppercase tracking-widest">{user?.role}</p>
                </div>
              )}
              <div className="flex-1 min-w-0 lg:hidden">
                <p className="text-sm font-bold text-slate-900 truncate tracking-tight">{user?.name}</p>
                <p className="text-[10px] text-primary font-bold uppercase tracking-widest">{user?.role}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 transition-all duration-200 active:scale-95",
                sidebarCollapsed && "lg:justify-center lg:px-3"
              )}
              title={sidebarCollapsed ? "Sign Out" : undefined}
            >
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {!sidebarCollapsed && <span className="lg:block hidden">Sign Out</span>}
              <span className="lg:hidden">Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={cn(
        "transition-all duration-300",
        sidebarCollapsed ? "lg:pl-20" : "lg:pl-64"
      )}>
        <header className="sticky top-0 z-20 h-16 bg-white/70 backdrop-blur-md border-b border-border/40 hidden lg:flex items-center justify-between px-8 bg-fabric">
          <div className="text-sm font-semibold text-slate-400 tracking-wide uppercase pl-12">
            {pathname.split('/').filter(Boolean).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' / ') || 'Dashboard'}
          </div>
          <div className="flex items-center gap-6">
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="group relative p-2.5 rounded-xl hover:bg-slate-50 transition-all duration-300 active:scale-90 shadow-soft hover:shadow-hover border border-transparent hover:border-border/40"
              >
                <svg className="w-5 h-5 text-slate-500 group-hover:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-soft animate-in zoom-in duration-300 ring-2 ring-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <>
                  <div className="fixed inset-0 z-0" onClick={() => setShowNotifications(false)} />
                  <div className="absolute right-0 mt-3 w-96 bg-white/95 backdrop-blur-xl rounded-2xl shadow-hover border border-border/40 overflow-hidden z-10 animate-in fade-in slide-in-from-top-2 duration-300 ease-soft">
                    <div className="p-4 bg-fabric border-b border-border/40 flex items-center justify-between">
                      <span className="font-bold text-slate-900 tracking-tight">Activity Stream</span>
                      {unreadCount > 0 && (
                        <button
                          onClick={() => markNotificationsRead()}
                          className="text-xs font-bold text-primary hover:opacity-80 transition-opacity"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-[32rem] overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-10 flex flex-col items-center justify-center text-center">
                          <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                            <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                          </div>
                          <p className="text-sm font-semibold text-slate-900">No notifications yet</p>
                          <p className="text-xs text-slate-400 mt-1">You&apos;ll see updates here when reports are submitted or reviewed.</p>
                        </div>
                      ) : (
                        notifications.slice(0, 10).map((n) => (
                          <div
                            key={n._id}
                            onClick={() => {
                              markNotificationsRead(n._id)
                              if (n.link) {
                                setShowNotifications(false)
                                router.push(n.link)
                              }
                            }}
                            className={cn(
                              "p-4 border-b border-border/20 last:border-0 cursor-pointer hover:bg-slate-50 transition-colors",
                              !n.isRead && "bg-primary/[0.02]"
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <div className={cn(
                                "w-2 h-2 rounded-full mt-1.5 shrink-0",
                                !n.isRead ? "bg-primary" : "bg-transparent"
                              )} />
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-0.5">
                                  {n.type.replace('_', ' ')}
                                </p>
                                <p className="text-sm font-medium text-slate-900 leading-snug">{n.message}</p>
                                <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-tight">
                                  {format(new Date(n.createdAt), 'MMM dd • HH:mm')}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-3 pl-6 border-l border-border/40">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-900 leading-none">{user?.name}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{user?.role}</p>
              </div>
              <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center border border-primary/20 shadow-soft">
                <span className="text-sm font-bold text-primary">
                  {user?.name?.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </header>

        <main className="p-8 pt-24 lg:pt-8 animate-in fade-in slide-in-from-bottom-2 duration-700 ease-soft">
          {children}
        </main>
      </div>
    </div>
  )
}
