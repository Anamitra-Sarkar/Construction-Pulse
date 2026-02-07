'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import api from '@/lib/api'
import { DEFAULT_CHECKLIST, Site } from '@/lib/types'
import { toast } from 'sonner'
import { AuthGuard } from '@/components/auth-guard'
import { DashboardLayout } from '@/components/dashboard-layout'
import { SectionHeading } from '@/components/SectionHeading'

function NewReportForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const siteId = searchParams.get('siteId')
  
  const [site, setSite] = useState<Site | null>(null)
  const [checklist, setChecklist] = useState(DEFAULT_CHECKLIST)
  const [photos, setPhotos] = useState<File[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (siteId) {
      api.get(`/sites/${siteId}`).then(res => setSite(res.data))
    }
  }, [siteId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!siteId) return
    
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('siteId', siteId)
      formData.append('checklist', JSON.stringify(checklist))
      photos.forEach(photo => formData.append('photos', photo))

      await api.post('/reports', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      toast.success('QA Report submitted successfully')
      router.push('/engineer/reports')
    } catch (error) {
      console.error('Failed to submit report:', error)
      toast.error('Failed to submit report')
    } finally {
      setLoading(false)
    }
  }

  const updateChecklist = (index: number, status: 'pass' | 'fail' | 'n/a') => {
    const newChecklist = [...checklist]
    newChecklist[index].status = status
    setChecklist(newChecklist)
  }

  if (!site) {
    return (
      <AuthGuard allowedRoles={['engineer']}>
        <DashboardLayout>
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </DashboardLayout>
      </AuthGuard>
    )
  }

  return (
    <AuthGuard allowedRoles={['engineer']}>
      <DashboardLayout>
        <div className="max-w-4xl mx-auto space-y-8">
          <SectionHeading subtitle={`Site: ${site.name} | ${site.location}`}>
            New QA Report
          </SectionHeading>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Inspection Item</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {checklist.map((item, i) => (
                <tr key={i}>
                  <td className="px-6 py-4 text-sm text-slate-900">{item.item}</td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center gap-2">
                      {['pass', 'fail', 'n/a'].map(status => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => updateChecklist(i, status as any)}
                          className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                            item.status === status 
                              ? (status === 'pass' ? 'bg-green-600 text-white' : status === 'fail' ? 'bg-red-600 text-white' : 'bg-slate-600 text-white')
                              : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}
                        >
                          {status.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-4">
          <h3 className="font-bold text-slate-900">Upload Site Photos (Max 5)</h3>
          <input 
            type="file" 
            multiple 
            accept="image/*"
            onChange={e => setPhotos(Array.from(e.target.files || []))}
            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        <div className="flex gap-4">
          <button 
            type="button" 
            onClick={() => router.back()}
            className="flex-1 py-3 border border-slate-200 rounded-xl text-slate-600 font-medium hover:bg-slate-50"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            disabled={loading}
            className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Submitting...' : 'Submit QA Report'}
          </button>
        </div>
          </div>
        </form>
        </div>
      </DashboardLayout>
    </AuthGuard>
  )
}

export default function NewReportPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <NewReportForm />
    </Suspense>
  )
}
