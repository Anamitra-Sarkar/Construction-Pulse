'use client'

import { useState, useEffect } from 'react'
import api from '@/lib/api'
import { Site, User } from '@/lib/types'
import { DashboardLayout } from '@/components/dashboard-layout'
import { AuthGuard } from '@/components/auth-guard'
import { asArray } from '@/lib/safe'

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [newSite, setNewSite] = useState({ name: '', location: '', description: '' })
  const [assigningSite, setAssigningSite] = useState<Site | null>(null)
  const [selectedEngineers, setSelectedEngineers] = useState<string[]>([])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [sitesRes, usersRes] = await Promise.all([
        api.get('/sites'),
        api.get('/auth/users')
      ])
      // Defensive: ensure arrays
      const sitesData = asArray<Site>(sitesRes.data)
      const usersData = asArray<User>(usersRes.data.users || usersRes.data)
      
      setSites(sitesData)
      setUsers(usersData.filter((u: User) => u.role === 'engineer'))
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSite = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post('/sites', newSite)
      setShowModal(false)
      fetchData()
    } catch (error) {
      console.error('Failed to create site:', error)
    }
  }

  const handleAssign = async () => {
    if (!assigningSite) return
    try {
      await api.post(`/sites/${assigningSite._id}/assign`, { engineerIds: selectedEngineers })
      setAssigningSite(null)
      fetchData()
    } catch (error) {
      console.error('Failed to assign engineers:', error)
    }
  }

  return (
    <AuthGuard allowedRoles={['admin']}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-slate-900">Construction Sites</h1>
            <button 
              onClick={() => setShowModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add New Site
            </button>
          </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sites.map(site => (
          <div key={site._id} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">{site.name}</h3>
                <p className="text-slate-500 text-sm">{site.location}</p>
              </div>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                site.status === 'on-track' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
              }`}>
                {site.status.replace('-', ' ').toUpperCase()}
              </span>
            </div>
            
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase">Compliance Score</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-600 rounded-full" 
                      style={{ width: `${site.complianceScore}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-slate-700">{site.complianceScore.toFixed(0)}%</span>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-400 uppercase mb-2">Assigned Engineers</p>
                <div className="flex flex-wrap gap-2">
                  {site.assignedEngineers.map(eng => (
                    <span key={eng._id} className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs">
                      {eng.name}
                    </span>
                  ))}
                  <button 
                    onClick={() => {
                      setAssigningSite(site)
                      setSelectedEngineers(site.assignedEngineers.map(e => e._id))
                    }}
                    className="text-blue-600 text-xs font-medium hover:underline"
                  >
                    + Manage
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Assign Modal */}
      {assigningSite && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Assign Engineers to {assigningSite.name}</h2>
            <div className="space-y-3 max-h-60 overflow-y-auto mb-6">
              {users.map(user => (
                <label key={user._id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedEngineers.includes(user._id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedEngineers([...selectedEngineers, user._id])
                      else setSelectedEngineers(selectedEngineers.filter(id => id !== user._id))
                    }}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-900">{user.name}</p>
                    <p className="text-xs text-slate-500">{user.email}</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setAssigningSite(null)}
                className="flex-1 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleAssign}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
      </DashboardLayout>
    </AuthGuard>
  )
}
