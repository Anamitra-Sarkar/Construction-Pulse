'use client'

import { useState, useEffect } from 'react'
import api from '@/lib/api'
import { AnalyticsSummary } from '@/lib/types'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { DashboardLayout } from '@/components/dashboard-layout'
import { AuthGuard } from '@/components/auth-guard'
import { asArray, asNumber } from '@/lib/safe'
import { ChartWrapper } from '@/components/ChartWrapper'
import { SectionHeading } from '@/components/SectionHeading'

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/analytics/summary')
        
        // Defensive: Normalize the response data
        const rawData = res.data || {}
        const normalizedData: AnalyticsSummary = {
          overview: {
            totalSites: asNumber(rawData.overview?.totalSites, 0),
            totalReports: asNumber(rawData.overview?.totalReports, 0),
            approvedReports: asNumber(rawData.overview?.approvedReports, 0),
            avgCompliance: asNumber(rawData.overview?.avgCompliance, 0),
            activeSites: asNumber(rawData.overview?.activeSites, 0),
            pendingReports: asNumber(rawData.overview?.pendingReports, 0),
            rejectedReports: asNumber(rawData.overview?.rejectedReports, 0),
          },
          dailyTrends: asArray(rawData.dailyTrends),
          siteComparison: asArray(rawData.siteComparison),
        }
        
        setData(normalizedData)
        setError(null)
      } catch (err: any) {
        console.error('Failed to fetch analytics:', err)
        if (err.response?.status === 404) {
          setError('Analytics endpoint not found. Please check your API configuration.')
        } else {
          setError('Failed to load analytics data. Please try again later.')
        }
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) return (
    <AuthGuard allowedRoles={['admin']}>
      <DashboardLayout>
        <div className="p-8">Loading analytics...</div>
      </DashboardLayout>
    </AuthGuard>
  )

  if (error) return (
    <AuthGuard allowedRoles={['admin']}>
      <DashboardLayout>
        <div className="p-8">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
            <h3 className="font-semibold text-yellow-900 mb-2">Analytics Unavailable</h3>
            <p className="text-yellow-700">{error}</p>
          </div>
        </div>
      </DashboardLayout>
    </AuthGuard>
  )
  
  // Safely get daily trends with fallback to empty array
  const dailyTrendsData = asArray(data?.dailyTrends)
  
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
    <AuthGuard allowedRoles={['admin']}>
      <DashboardLayout>
        <div className="space-y-8">
          <SectionHeading subtitle="View comprehensive quality metrics and trends">
            Enterprise Analytics
          </SectionHeading>
      
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Sites', value: data?.overview?.totalSites ?? 0, color: 'blue' },
          { label: 'Total Reports', value: data?.overview?.totalReports ?? 0, color: 'slate' },
          { label: 'Approved Reports', value: data?.overview?.approvedReports ?? 0, color: 'green' },
          { label: 'Avg Compliance', value: `${asNumber(data?.overview?.avgCompliance, 0).toFixed(1)}%`, color: 'blue' },
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
          <ChartWrapper minHeight="min-h-[320px]">
            {validDailyTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
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
          </ChartWrapper>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-6">Compliance Trend</h2>
          <ChartWrapper minHeight="min-h-[320px]">
            {validDailyTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
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
          </ChartWrapper>
        </div>
      </div>
    </div>
      </DashboardLayout>
    </AuthGuard>
  )
}
