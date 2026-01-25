'use client'

import { useState, useEffect } from 'react'
import api from '@/lib/api'
import { Site } from '@/lib/types'
import Link from 'next/link'

export default function EngineerSitesPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSites = async () => {
      try {
        const res = await api.get('/sites')
        setSites(res.data)
      } catch (error) {
        console.error('Failed to fetch assigned sites:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchSites()
  }, [])

  if (loading) return <div className="p-8 text-slate-500">Loading your sites...</div>

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Your Assigned Sites</h1>
        <p className="text-slate-500 mt-1">Select a site to submit a new QA report</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sites.length > 0 ? (
          sites.map(site => (
            <div key={site._id} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col h-full">
              <div className="flex-1">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-slate-900">{site.name}</h3>
                    <p className="text-slate-500 text-sm">{site.location}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    site.status === 'on-track' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
                  }`}>
                    {site.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-slate-600 line-clamp-2 mb-4">{site.description}</p>
              </div>
              
              <Link 
                href={`/engineer/new-report?siteId=${site._id}`}
                className="w-full mt-4 bg-blue-600 text-white py-2 rounded-lg font-medium text-center hover:bg-blue-700 transition-colors"
              >
                Start QA Report
              </Link>
            </div>
          ))
        ) : (
          <div className="col-span-full py-12 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
            <p className="text-slate-500">No sites assigned to you yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
