'use client'

import { AuthGuard } from '@/components/auth-guard'
import { DashboardLayout } from '@/components/dashboard-layout'
import { useAuth } from '@/lib/auth-context'
import { useEffect, useState } from 'react'
import { Site, QAReport } from '@/lib/types'
import Link from 'next/link'
import { SectionHeading } from '@/components/SectionHeading'
import api from '@/lib/api'
import { asArray } from '@/lib/safe'

// Maximum time to wait for API response (in ms)
const LOADING_TIMEOUT = 5000

export default function EngineerDashboard() {
  const { user } = useAuth()
  const [sites, setSites] = useState<Site[]>([])
  const [reports, setReports] = useState<QAReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    
    let timeoutId: NodeJS.Timeout | null = null
    
    const fetchData = async () => {
      // Set a timeout to prevent infinite loading
      timeoutId = setTimeout(() => {
        setLoading(false)
        setError('Loading took too long. Please refresh the page.')
      }, LOADING_TIMEOUT)
      
      try {
        const [sitesRes, reportsRes] = await Promise.all([
          api.get('/sites'),
          api.get('/reports?limit=5'),
        ])
        
        if (timeoutId) clearTimeout(timeoutId)
        
        setSites(asArray(sitesRes.data))
        setReports(asArray(reportsRes.data))
        setError(null)
      } catch (err: any) {
        if (timeoutId) clearTimeout(timeoutId)
        console.error('Failed to fetch engineer dashboard data:', err)
        if (err.response?.status === 401) {
          setError('Session expired. Please log in again.')
        } else {
          setError('Failed to load dashboard data. Please try again.')
        }
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [user])

  const pendingCount = reports.filter((r) => r.status === 'pending').length
  const approvedCount = reports.filter((r) => r.status === 'approved').length
  const rejectedCount = reports.filter((r) => r.status === 'rejected').length

  return (
    <AuthGuard allowedRoles={['engineer']}>
      <DashboardLayout>
        <div className="space-y-6">
          <SectionHeading subtitle="Your assigned sites and recent activity">
            Welcome, {user?.name}
          </SectionHeading>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-sm text-slate-500">Loading dashboard...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
            <svg className="w-12 h-12 mx-auto mb-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3 className="font-semibold text-red-900 mb-2">Unable to Load Dashboard</h3>
            <p className="text-red-700 text-sm mb-6">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <p className="text-sm text-slate-500">Assigned Sites</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{sites.length}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <p className="text-sm text-slate-500">Pending Reports</p>
                <p className="text-2xl font-bold text-yellow-600 mt-1">{pendingCount}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <p className="text-sm text-slate-500">Approved / Rejected</p>
                <p className="text-2xl font-bold mt-1">
                  <span className="text-green-600">{approvedCount}</span>
                  <span className="text-slate-300"> / </span>
                  <span className="text-red-600">{rejectedCount}</span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-900">My Sites</h3>
                  <Link href="/engineer/sites" className="text-sm text-blue-600 hover:text-blue-700">View all</Link>
                </div>
                <div className="space-y-3">
                  {sites.slice(0, 5).map((site) => (
                    <Link
                      key={site._id}
                      href={`/engineer/new-report?siteId=${site._id}`}
                      className="block p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-900">{site.name}</p>
                          <p className="text-sm text-slate-500">{site.location}</p>
                        </div>
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          site.status === 'on-track' ? 'bg-green-100 text-green-700' :
                          site.status === 'on_hold' ? 'bg-yellow-100 text-yellow-700' :
                          site.status === 'delayed' ? 'bg-red-100 text-red-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {site.status?.replace('-', ' ').replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                    </Link>
                  ))}
                  {sites.length === 0 && (
                    <p className="text-sm text-slate-500 text-center py-4">No sites assigned yet</p>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-900">Recent Reports</h3>
                  <Link href="/engineer/reports" className="text-sm text-blue-600 hover:text-blue-700">View all</Link>
                </div>
                <div className="space-y-3">
                  {reports.slice(0, 5).map((report) => (
                    <div key={report._id} className="p-3 rounded-lg border border-slate-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-900">{(report.site as any)?.name || 'Unknown Site'}</p>
                          <p className="text-sm text-slate-500">{report.submittedAt ? new Date(report.submittedAt).toLocaleDateString() : ''}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-600">{report.complianceScore?.toFixed(0)}%</span>
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            report.status === 'approved' ? 'bg-green-100 text-green-700' :
                            report.status === 'rejected' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {report.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {reports.length === 0 && (
                    <p className="text-sm text-slate-500 text-center py-4">No reports submitted yet</p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6">
              <Link
                href="/engineer/new-report"
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Submit New Report
              </Link>
            </div>
          </>
        )}
        </div>
      </DashboardLayout>
    </AuthGuard>
  )
}
