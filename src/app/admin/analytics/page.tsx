'use client'

import { useState, useEffect } from 'react'
import api from '@/lib/api'
import { AnalyticsSummary } from '@/lib/types'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/analytics/summary')
        setData(res.data)
      } catch (error) {
        console.error('Failed to fetch analytics:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) return <div className="p-8">Loading analytics...</div>

  // Safely get daily trends with fallback to empty array
  const dailyTrendsData = Array.isArray(data?.dailyTrends) ? data.dailyTrends : []
  
  // Filter out invalid data entries and ensure all required fields exist
  const validDailyTrends = dailyTrendsData.filter(trend => 
    trend && 
    typeof trend._id === 'string' && 
    typeof trend.count === 'number' &&
    !isNaN(trend.count) &&
    typeof trend.avgCompliance === 'number' &&
    !isNaN(trend.avgCompliance)
  )

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-2xl font-bold text-slate-900">Enterprise Analytics</h1>
      
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Sites', value: data?.overview?.totalSites ?? 0, color: 'blue' },
          { label: 'Total Reports', value: data?.overview?.totalReports ?? 0, color: 'slate' },
          { label: 'Approved Reports', value: data?.overview?.approvedReports ?? 0, color: 'green' },
          { label: 'Avg Compliance', value: `${(data?.overview?.avgCompliance ?? 0).toFixed(1)}%`, color: 'blue' },
        ].map((card, i) => (
          <div key={i} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-sm font-medium text-slate-500">{card.label}</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-6">Submission Trends (Last 7 Days)</h2>
          <div className="h-80 w-full">
            {validDailyTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={validDailyTrends}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="_id" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">
                No data available for the last 7 days
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-6">Compliance Trend</h2>
          <div className="h-80 w-full">
            {validDailyTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={validDailyTrends}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="_id" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="avgCompliance" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">
                No compliance data available
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
