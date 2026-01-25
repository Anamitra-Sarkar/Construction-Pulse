'use client'

import { useState, useEffect } from 'react'
import api from '@/lib/api'
import { AuditLog } from '@/lib/types'
import { format } from 'date-fns'

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLogs()
  }, [])

  const fetchLogs = async () => {
    try {
      const res = await api.get('/audit')
      setLogs(res.data)
    } catch (error) {
      console.error('Failed to fetch audit logs:', error)
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
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">System Audit Logs</h1>
        <button 
          onClick={exportCSV}
          className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          Export CSV
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Timestamp</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">User</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Action</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {logs.map(log => (
              <tr key={log._id} className="hover:bg-slate-50">
                <td className="px-6 py-4 text-sm text-slate-500">
                  {format(new Date(log.timestamp), 'MMM dd, HH:mm:ss')}
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
