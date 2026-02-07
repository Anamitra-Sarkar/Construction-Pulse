'use client'

import { useState, useEffect, useRef } from 'react'
import api from '@/lib/api'
import { AuditLog } from '@/lib/types'
import { format } from 'date-fns'
import { DashboardLayout } from '@/components/dashboard-layout'
import { AuthGuard } from '@/components/auth-guard'
import { asArray, asDate } from '@/lib/safe'
import { SectionHeading } from '@/components/SectionHeading'

// Maximum time to wait for API response (in ms)
const LOADING_TIMEOUT = 5000

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    fetchLogs()
    
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const fetchLogs = async () => {
    setLoading(true)
    setError(null)
    
    // Set a timeout to prevent infinite loading
    timeoutRef.current = setTimeout(() => {
      setLoading(false)
      setError('Loading took too long. Please refresh the page.')
    }, LOADING_TIMEOUT)
    
    try {
      const res = await api.get('/audit')
      
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      
      // Defensive: ensure we always get an array
      const logsData = asArray<AuditLog>(res.data)
      setLogs(logsData)
      setError(null)
    } catch (err: any) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      console.error('Failed to fetch audit logs:', err)
      if (err.response?.status === 401) {
        setError('Unauthorized: Session expired or insufficient permissions.')
      } else if (err.response?.status === 404) {
        setError('Audit service not configured.')
      } else {
        setError('Failed to load audit logs. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const exportCSV = () => {
    const headers = ['Timestamp', 'User', 'Action', 'Details']
    const rows = logs.map(log => [
      format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss'),
      log.user?.email || 'System',
      log.action,
      JSON.stringify(log.details).replace(/"/g, '""')
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => `"${row.join('","')}"`)
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `audit_logs_${format(new Date(), 'yyyyMMdd')}.csv`
    link.click()
  }

  return (
    <AuthGuard allowedRoles={['admin']}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <SectionHeading subtitle="View all system activity and security logs">
              System Audit Logs
            </SectionHeading>
            <button 
              onClick={exportCSV}
              disabled={logs.length === 0}
              className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Export CSV
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6">
              <div className="flex items-start gap-4">
                <svg className="w-6 h-6 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="text-red-700 font-medium">{error}</p>
                  <button
                    onClick={() => fetchLogs()}
                    className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                  >
                    Retry
                  </button>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="text-sm text-slate-500">Loading audit logs...</p>
            </div>
          ) : !error && logs.length === 0 ? (
            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-12 text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No Audit Logs Yet</h3>
              <p className="text-slate-500 text-sm">
                System activity will appear here as users perform actions.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[800px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Timestamp</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">User</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Action</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {logs.map(log => {
                    const timestamp = asDate(log.timestamp)
                    return (
                      <tr key={log._id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 text-sm text-slate-500">
                          {format(timestamp, 'MMM dd, HH:mm:ss')}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm">
                            <p className="font-medium text-slate-900">{log.user?.name || 'System'}</p>
                            <p className="text-slate-500">{log.user?.role?.toUpperCase()}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-mono bg-slate-100 px-2 py-1 rounded">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">
                          {JSON.stringify(log.details)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </div>
      </DashboardLayout>
    </AuthGuard>
  )
}
