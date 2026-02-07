'use client'

import { AuthGuard } from '@/components/auth-guard'
import { DashboardLayout } from '@/components/dashboard-layout'
import { useAuth } from '@/lib/auth-context'
import { useEffect, useState } from 'react'
import { Site, QAReport } from '@/lib/types'
import Link from 'next/link'
import { SectionHeading } from '@/components/SectionHeading'

export default function EngineerDashboard() {
  const { token, user } = useAuth()
  const [sites, setSites] = useState<Site[]>([])
  const [reports, setReports] = useState<QAReport[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      Promise.all([
        fetch('/api/sites', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch('/api/reports?limit=5', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      ]).then(([sitesData, reportsData]) => {
        setSites(sitesData.sites || [])
        setReports(reportsData.reports || [])
        setLoading(false)
      })
    }
  }, [token])

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
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
                      key={site.id}
                      href={`/engineer/new-report?site=${site.id}`}
                      className="block p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-900">{site.name}</p>
                          <p className="text-sm text-slate-500">{site.city}</p>
                        </div>
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          site.status === 'active' ? 'bg-green-100 text-green-700' :
                          site.status === 'on_hold' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {site.status}
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
                    <div key={report.id} className="p-3 rounded-lg border border-slate-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-900">{report.site?.name || 'Unknown Site'}</p>
                          <p className="text-sm text-slate-500">{report.report_date}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-600">{report.compliance_score?.toFixed(0)}%</span>
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
