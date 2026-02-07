'use client'

import { AuthGuard } from '@/components/auth-guard'
import { DashboardLayout } from '@/components/dashboard-layout'
import { useAuth } from '@/lib/auth-context'
import { useEffect, useState } from 'react'
import { DashboardAnalytics } from '@/lib/types'
import Link from 'next/link'
import { asArray, asNumber } from '@/lib/safe'
import { SectionHeading } from '@/components/SectionHeading'
import api from '@/lib/api'

// Maximum time to wait for API response (in ms)
const LOADING_TIMEOUT = 5000

export default function AdminDashboard() {
  const { user } = useAuth()
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    
    let timeoutId: NodeJS.Timeout | null = null
    
    const fetchAnalytics = async () => {
      // Set a timeout to prevent infinite loading
      timeoutId = setTimeout(() => {
        setLoading(false)
        setErrorMessage('Loading took too long. Please refresh the page.')
      }, LOADING_TIMEOUT)
      
      try {
        const res = await api.get('/analytics/dashboard')
        
        if (timeoutId) clearTimeout(timeoutId)
        
        const data = res.data
        // Ensure data has expected structure with safe defaults
        const normalizedData: DashboardAnalytics = {
          summary: {
            totalSites: asNumber(data?.summary?.totalSites, 0),
            activeSites: asNumber(data?.summary?.activeSites, 0),
            pendingReports: asNumber(data?.summary?.pendingReports, 0),
            averageCompliance: asNumber(data?.summary?.averageCompliance, 0),
            totalReports: asNumber(data?.summary?.totalReports, 0),
            approvedReports: asNumber(data?.summary?.approvedReports, 0),
            rejectedReports: asNumber(data?.summary?.rejectedReports, 0),
            approvedRate: asNumber(data?.summary?.approvedRate, 0),
          },
          dailyTrends: asArray(data?.dailyTrends),
          siteComparison: asArray(data?.siteComparison),
        }
        setAnalytics(normalizedData)
        setErrorMessage(null)
      } catch (error: any) {
        if (timeoutId) clearTimeout(timeoutId)
        console.error('Failed to fetch analytics:', error)
        
        if (error.response?.status === 401) {
          setErrorMessage('Session expired or unauthorized. Please log in again.')
        } else if (error.response?.status === 404) {
          setErrorMessage('Analytics service not configured. Dashboard metrics may be unavailable.')
        } else {
          setErrorMessage('Failed to load analytics. Dashboard may show limited data.')
        }
        // Don't set analytics to enable fallback UI
      } finally {
        setLoading(false)
      }
    }
    
    fetchAnalytics()
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [user])

  return (
    <AuthGuard allowedRoles={['admin']}>
      <DashboardLayout>
        <div className="space-y-6">
          <SectionHeading subtitle="Overview of construction quality metrics">
            Admin Dashboard
          </SectionHeading>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="text-sm text-slate-500">Loading dashboard...</p>
            </div>
          ) : !analytics ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8">
              <div className="flex items-start gap-4">
                <svg className="w-8 h-8 text-yellow-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <h3 className="font-semibold text-yellow-900 mb-2">Analytics Not Available</h3>
                  {errorMessage ? (
                    <p className="text-yellow-700 text-sm">{errorMessage}</p>
                  ) : (
                    <p className="text-yellow-700 text-sm">
                      Unable to load dashboard analytics. This could be due to:
                    </p>
                  )}
                  {!errorMessage && (
                    <ul className="list-disc list-inside text-yellow-700 text-sm mt-2 space-y-1">
                      <li>Analytics endpoint not configured</li>
                      <li>Insufficient permissions</li>
                      <li>Temporary service unavailability</li>
                    </ul>
                  )}
                  <div className="flex items-center gap-4 mt-4">
                    <button
                      onClick={() => window.location.reload()}
                      className="text-yellow-700 text-sm font-medium hover:text-yellow-800 underline"
                    >
                      Retry
                    </button>
                    <p className="text-yellow-600 text-xs">
                      You can still access other admin features via the navigation menu.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard
                label="Total Sites"
                value={analytics.summary.totalSites}
                icon="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5"
                color="blue"
              />
              <StatCard
                label="Active Sites"
                value={analytics.summary.activeSites}
                icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                color="green"
              />
              <StatCard
                label="Pending Reports"
                value={analytics.summary.pendingReports}
                icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                color="yellow"
              />
              <StatCard
                label="Avg Compliance"
                value={`${analytics.summary.averageCompliance.toFixed(1)}%`}
                icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2z"
                color="purple"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              <StatCard
                label="Total Reports"
                value={analytics.summary.totalReports}
                icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586"
                color="slate"
              />
              <StatCard
                label="Approved"
                value={analytics.summary.approvedReports}
                icon="M5 13l4 4L19 7"
                color="green"
              />
              <StatCard
                label="Rejected"
                value={analytics.summary.rejectedReports}
                icon="M6 18L18 6M6 6l12 12"
                color="red"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-4">Site Performance</h3>
                <div className="space-y-3">
                  {asArray(analytics.siteComparison).slice(0, 5).map((site) => (
                    <div key={site.site_id} className="flex items-center justify-between">
                      <span className="text-sm text-slate-600 truncate max-w-[200px]">
                        {site.site_name}
                      </span>
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 rounded-full"
                            style={{ width: `${asNumber(site.avg_compliance, 0)}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-slate-900 w-12 text-right">
                          {asNumber(site.avg_compliance, 0).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
                  {asArray(analytics.siteComparison).length === 0 && (
                    <p className="text-sm text-slate-500 text-center py-4">No site data available</p>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-4">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Link
                    href="/admin/sites"
                    className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                  >
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-slate-900">Manage Sites</span>
                  </Link>
                  <Link
                    href="/admin/users"
                    className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                  >
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-slate-900">Manage Users</span>
                  </Link>
                  <Link
                    href="/admin/reports"
                    className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                  >
                    <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-slate-900">Review Reports</span>
                  </Link>
                  <Link
                    href="/admin/analytics"
                    className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                  >
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2z" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-slate-900">View Analytics</span>
                  </Link>
                </div>
              </div>
            </div>
          </>
        )}
        </div>
      </DashboardLayout>
    </AuthGuard>
  )
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string
  value: string | number
  icon: string
  color: 'blue' | 'green' | 'yellow' | 'purple' | 'red' | 'slate'
}) {
  const colors = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    purple: 'bg-purple-100 text-purple-600',
    red: 'bg-red-100 text-red-600',
    slate: 'bg-slate-100 text-slate-600',
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
          </svg>
        </div>
      </div>
    </div>
  )
}
