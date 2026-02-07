'use client'

import { useState, useEffect, useRef } from 'react'
import api from '@/lib/api'
import { QAReport } from '@/lib/types'
import { format } from 'date-fns'
import { DashboardLayout } from '@/components/dashboard-layout'
import { AuthGuard } from '@/components/auth-guard'
import { asArray } from '@/lib/safe'
import { SectionHeading } from '@/components/SectionHeading'
import { toast } from 'sonner'
import Link from 'next/link'

// Maximum time to wait for API response (in ms)
const LOADING_TIMEOUT = 5000

export default function AdminReportsPage() {
  const [reports, setReports] = useState<QAReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedReport, setSelectedReport] = useState<QAReport | null>(null)
  const [feedback, setFeedback] = useState('')
  const [isReviewing, setIsReviewing] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    fetchReports()
    
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const fetchReports = async () => {
    setLoading(true)
    setError(null)
    
    // Set a timeout to prevent infinite loading
    timeoutRef.current = setTimeout(() => {
      setLoading(false)
      setError('Loading took too long. Please refresh the page.')
    }, LOADING_TIMEOUT)
    
    try {
      const res = await api.get('/reports')
      
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      
      // Defensive: ensure array
      const reportsData = asArray<QAReport>(res.data)
      setReports(reportsData)
      setError(null)
    } catch (err: any) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      console.error('Failed to fetch reports:', err)
      if (err.response?.status === 401) {
        setError('Session expired. Please log in again.')
      } else {
        setError('Failed to load reports. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleReview = async (status: 'approved' | 'rejected') => {
    if (!selectedReport) return
    setIsReviewing(true)
    try {
      await api.patch(`/reports/${selectedReport._id}/review`, { status, adminFeedback: feedback })
      toast.success(`Report ${status} successfully`)
      setSelectedReport(null)
      setFeedback('')
      fetchReports()
    } catch (error) {
      console.error('Failed to review report:', error)
      toast.error('Failed to review report')
    } finally {
      setIsReviewing(false)
    }
  }

  if (loading) {
    return (
      <AuthGuard allowedRoles={['admin']}>
        <DashboardLayout>
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-sm text-slate-500">Loading reports...</p>
          </div>
        </DashboardLayout>
      </AuthGuard>
    )
  }

  if (error) {
    return (
      <AuthGuard allowedRoles={['admin']}>
        <DashboardLayout>
          <div className="space-y-6">
            <SectionHeading subtitle="Review and approve quality assurance reports">
              QA Reports Review
            </SectionHeading>
            <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
              <svg className="w-12 h-12 mx-auto mb-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="font-semibold text-red-900 mb-2">Unable to Load Reports</h3>
              <p className="text-red-700 text-sm mb-6">{error}</p>
              <button
                onClick={() => fetchReports()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        </DashboardLayout>
      </AuthGuard>
    )
  }

  return (
    <AuthGuard allowedRoles={['admin']}>
      <DashboardLayout>
        <div className="space-y-6">
          <SectionHeading subtitle="Review and approve quality assurance reports">
            QA Reports Review
          </SectionHeading>

      {reports.length === 0 ? (
        <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-12 text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No Reports to Review</h3>
          <p className="text-slate-500 text-sm">
            QA reports submitted by engineers will appear here for review.
          </p>
        </div>
      ) : (
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-left min-w-[700px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Site</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Engineer</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Score</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Status</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Date</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {reports.map(report => (
              <tr key={report._id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-medium text-slate-900">{(report.site as any)?.name || 'Unknown Site'}</td>
                <td className="px-6 py-4">{(report.engineer as any)?.name || 'Unknown Engineer'}</td>
                <td className="px-6 py-4 font-bold text-blue-600">{report.complianceScore?.toFixed(0) ?? 0}%</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    report.status === 'approved' ? 'bg-green-50 text-green-600' : 
                    report.status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                  }`}>
                    {report.status?.toUpperCase() || 'PENDING'}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-500">{report.submittedAt ? format(new Date(report.submittedAt), 'MMM dd, yyyy') : 'N/A'}</td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => setSelectedReport(report)}
                    className="text-blue-600 hover:underline text-sm font-medium"
                  >
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
      )}

      {selectedReport && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-8 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold">QA Report: {(selectedReport.site as any).name}</h2>
                <p className="text-slate-500">Submitted by {(selectedReport.engineer as any).name} on {format(new Date(selectedReport.submittedAt), 'PPPP')}</p>
              </div>
              <button onClick={() => setSelectedReport(null)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="font-bold text-slate-900 border-b pb-2">Checklist Items</h3>
                <div className="space-y-2">
                  {selectedReport.checklist.map((item, i) => (
                    <div key={i} className="flex justify-between items-center p-2 bg-slate-50 rounded">
                      <span className="text-sm">{item.item}</span>
                      <span className={`text-xs font-bold ${
                        item.status === 'pass' ? 'text-green-600' : 
                        item.status === 'fail' ? 'text-red-600' : 'text-slate-400'
                      }`}>
                        {item.status.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="font-bold text-slate-900 border-b pb-2 mb-4">Site Photos</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedReport.photos.map((photo, i) => (
                      <img key={i} src={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}${photo}`} alt="Site" className="rounded-lg object-cover h-40 w-full" />
                    ))}
                  </div>
                </div>

                {selectedReport.status === 'pending' && (
                  <div className="space-y-4 bg-slate-50 p-6 rounded-xl border border-slate-200">
                    <h3 className="font-bold">Review Decision</h3>
                    <textarea 
                      placeholder="Add feedback for the engineer..."
                      className="w-full p-3 border rounded-lg h-24 outline-none"
                      value={feedback}
                      onChange={e => setFeedback(e.target.value)}
                      disabled={isReviewing}
                    />
                    <div className="flex gap-3">
                      <button 
                        onClick={() => handleReview('rejected')} 
                        disabled={isReviewing}
                        className="flex-1 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg font-medium hover:bg-red-100 disabled:opacity-50"
                      >
                        {isReviewing ? 'Processing...' : 'Reject'}
                      </button>
                      <button 
                        onClick={() => handleReview('approved')} 
                        disabled={isReviewing}
                        className="flex-1 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
                      >
                        {isReviewing ? 'Processing...' : 'Approve'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
      </DashboardLayout>
    </AuthGuard>
  )
}
