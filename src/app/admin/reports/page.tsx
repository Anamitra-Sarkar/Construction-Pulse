'use client'

import { useState, useEffect } from 'react'
import api from '@/lib/api'
import { QAReport } from '@/lib/types'
import { format } from 'date-fns'

export default function AdminReportsPage() {
  const [reports, setReports] = useState<QAReport[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedReport, setSelectedReport] = useState<QAReport | null>(null)
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    fetchReports()
  }, [])

  const fetchReports = async () => {
    try {
      const res = await api.get('/reports')
      setReports(res.data)
    } catch (error) {
      console.error('Failed to fetch reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleReview = async (status: 'approved' | 'rejected') => {
    if (!selectedReport) return
    try {
      await api.patch(`/reports/${selectedReport._id}/review`, { status, adminFeedback: feedback })
      setSelectedReport(null)
      setFeedback('')
      fetchReports()
    } catch (error) {
      console.error('Failed to review report:', error)
    }
  }

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">QA Reports Review</h1>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left">
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
                <td className="px-6 py-4 font-medium text-slate-900">{(report.site as any).name}</td>
                <td className="px-6 py-4">{(report.engineer as any).name}</td>
                <td className="px-6 py-4 font-bold text-blue-600">{report.complianceScore.toFixed(0)}%</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    report.status === 'approved' ? 'bg-green-50 text-green-600' : 
                    report.status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                  }`}>
                    {report.status.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-500">{format(new Date(report.submittedAt), 'MMM dd, yyyy')}</td>
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
                    />
                    <div className="flex gap-3">
                      <button onClick={() => handleReview('rejected')} className="flex-1 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg font-medium hover:bg-red-100">Reject</button>
                      <button onClick={() => handleReview('approved')} className="flex-1 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700">Approve</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
