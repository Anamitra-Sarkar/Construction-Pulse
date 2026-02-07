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

// Maximum time to wait for API response (in ms)
const LOADING_TIMEOUT = 5000

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null
    
    const fetchData = async () => {
      // Set a timeout to prevent infinite loading
      timeoutId = setTimeout(() => {
        setLoading(false)
        setError('Loading took too long. Please refresh the page.')
      }, LOADING_TIMEOUT)
      
      try {
        const res = await api.get('/analytics/summary')
        
        if (timeoutId) clearTimeout(timeoutId)
        
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
        if (timeoutId) clearTimeout(timeoutId)
        console.error('Failed to fetch analytics:', err)
        if (err.response?.status === 401) {
          setError('Session expired. Please log in again.')
        } else if (err.response?.status === 404) {
          setError('Analytics service not configured yet.')
        } else {
          setError('Failed to load analytics data. Please try again.')
        }
      } finally {
        setLoading(false)
      }
    }
    fetchData()
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [])

  if (loading) return (
    <AuthGuard allowedRoles={['admin']}>
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-sm text-slate-500">Loading analytics...</p>
        </div>
      </DashboardLayout>
    </AuthGuard>
  )

  if (error) return (
    <AuthGuard allowedRoles={['admin']}>
      <DashboardLayout>
        <div className="space-y-8">
          <SectionHeading subtitle="View comprehensive quality metrics and trends">
            Enterprise Analytics
          </SectionHeading>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8">
            <div className="flex items-start gap-4">
              <svg className="w-8 h-8 text-yellow-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h3 className="font-semibold text-yellow-900 mb-2">Analytics Unavailable</h3>
                <p className="text-yellow-700">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded-lg font-medium hover:bg-yellow-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
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
