'use client'

import { useState, useEffect } from 'react'
import api from '@/lib/api'
import { User } from '@/lib/types'
import { useAuth } from '@/lib/auth-context'
import { DashboardLayout } from '@/components/dashboard-layout'
import { AuthGuard } from '@/components/auth-guard'
import { asArray, asNumber } from '@/lib/safe'
import { SectionHeading } from '@/components/SectionHeading'

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [adminCount, setAdminCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState<User | null>(null)
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'engineer' })
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    if (!currentUser) return
    fetchUsers()
  }, [currentUser])

  const fetchUsers = async () => {
    try {
      const res = await api.get('/auth/users')
      // Defensive: ensure array
      const usersData = asArray<User>(res.data.users || res.data)
      setUsers(usersData)
      setAdminCount(asNumber(res.data.adminCount, 0))
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await api.post('/auth/users', newUser)
      setShowModal(false)
      fetchUsers()
      setNewUser({ name: '', email: '', password: '', role: 'engineer' })
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create user')
    }
  }

  const handleToggleStatus = async (user: User) => {
    setActionError('')
    try {
      const newStatus = user.status === 'active' ? 'inactive' : 'active'
      await api.patch(`/auth/users/${user._id}`, { status: newStatus })
      fetchUsers()
    } catch (err: any) {
      if (err.response?.data?.code === 'LAST_ADMIN_PROTECTION') {
        setActionError(err.response.data.message)
      } else {
        setActionError(err.response?.data?.message || 'Failed to update status')
      }
    }
  }

  const handleRoleChange = async (user: User, newRole: 'admin' | 'engineer') => {
    setActionError('')
    if (user.role === newRole) return
    try {
      await api.patch(`/auth/users/${user._id}`, { role: newRole })
      fetchUsers()
    } catch (err: any) {
      if (err.response?.data?.code === 'LAST_ADMIN_PROTECTION') {
        setActionError(err.response.data.message)
      } else {
        setActionError(err.response?.data?.message || 'Failed to update role')
      }
    }
  }

  const handleDeleteUser = async (user: User) => {
    setActionError('')
    try {
      await api.delete(`/auth/users/${user._id}`)
      setShowDeleteModal(null)
      fetchUsers()
    } catch (err: any) {
      if (err.response?.data?.code === 'LAST_ADMIN_PROTECTION') {
        setActionError(err.response.data.message)
        setShowDeleteModal(null)
      } else {
        setActionError(err.response?.data?.message || 'Failed to delete user')
        setShowDeleteModal(null)
      }
    }
  }

  const isLastActiveAdmin = (user: User) => {
    return user.role === 'admin' && user.status === 'active' && adminCount <= 1
  }

  return (
    <AuthGuard allowedRoles={['admin']}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <SectionHeading 
              subtitle={`${adminCount} active admin${adminCount !== 1 ? 's' : ''} in system`}
            >
              User Management
            </SectionHeading>
        <button 
          onClick={() => setShowModal(true)}
          className="btn-refined"
        >
          Add New User
        </button>
      </div>

      {actionError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 animate-in fade-in duration-300">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="font-semibold">Action Blocked</p>
              <p className="mt-1">{actionError}</p>
            </div>
          </div>
          <button 
            onClick={() => setActionError('')}
            className="mt-3 text-xs font-semibold text-red-600 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="tactile-card overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50/50 border-b border-border/40">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">User</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {users.map(user => (
              <tr key={user._id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center border border-primary/20">
                      <span className="text-sm font-bold text-primary">
                        {user.name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{user.name}</p>
                      <p className="text-sm text-slate-500">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <select
                    value={user.role}
                    onChange={(e) => handleRoleChange(user, e.target.value as 'admin' | 'engineer')}
                    disabled={isLastActiveAdmin(user) || user._id === currentUser?._id}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                      user.role === 'admin' 
                        ? 'bg-purple-50 text-purple-700 border-purple-200' 
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                    } ${isLastActiveAdmin(user) ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'}`}
                  >
                    <option value="admin">ADMIN</option>
                    <option value="engineer">ENGINEER</option>
                  </select>
                  {isLastActiveAdmin(user) && (
                    <p className="text-[10px] text-amber-600 mt-1 font-semibold">Last admin - protected</p>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1.5 text-xs font-bold rounded-lg ${
                    user.status === 'active' 
                      ? 'bg-green-50 text-green-700' 
                      : 'bg-red-50 text-red-700'
                  }`}>
                    {user.status?.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button 
                      onClick={() => handleToggleStatus(user)}
                      disabled={isLastActiveAdmin(user) && user.status === 'active'}
                      className={`text-sm font-semibold transition-colors ${
                        isLastActiveAdmin(user) && user.status === 'active'
                          ? 'text-slate-300 cursor-not-allowed'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {user.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                    {user._id !== currentUser?._id && (
                      <button 
                        onClick={() => setShowDeleteModal(user)}
                        disabled={isLastActiveAdmin(user)}
                        className={`text-sm font-semibold transition-colors ${
                          isLastActiveAdmin(user)
                            ? 'text-slate-300 cursor-not-allowed'
                            : 'text-red-500 hover:text-red-700'
                        }`}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
          <form onSubmit={handleCreateUser} className="bg-white rounded-2xl p-8 w-full max-w-md space-y-5 shadow-hover animate-in zoom-in-95 duration-300">
            <h2 className="text-xl font-bold tracking-tight">Add New Enterprise User</h2>
            
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">Full Name</label>
              <input
                type="text"
                required
                className="input-refined"
                value={newUser.name}
                onChange={e => setNewUser({...newUser, name: e.target.value})}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">Email Address</label>
              <input
                type="email"
                required
                className="input-refined"
                value={newUser.email}
                onChange={e => setNewUser({...newUser, email: e.target.value})}
                placeholder="john@company.com"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">Temporary Password</label>
              <input
                type="password"
                required
                minLength={6}
                className="input-refined"
                value={newUser.password}
                onChange={e => setNewUser({...newUser, password: e.target.value})}
                placeholder="Min. 6 characters"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">Role</label>
              <select
                className="input-refined"
                value={newUser.role}
                onChange={e => setNewUser({...newUser, role: e.target.value})}
              >
                <option value="engineer">Engineer</option>
                <option value="admin">Admin</option>
              </select>
              {newUser.role === 'admin' && (
                <p className="text-xs text-amber-600 font-medium mt-1">
                  Admin users have full system access including user management.
                </p>
              )}
            </div>
            <div className="flex gap-3 mt-6 pt-4 border-t border-border/40">
              <button 
                type="button" 
                onClick={() => { setShowModal(false); setError(''); }}
                className="flex-1 py-2.5 border border-border/60 rounded-xl font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="flex-1 btn-refined"
              >
                Create User
              </button>
            </div>
          </form>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-hover animate-in zoom-in-95 duration-300">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-center tracking-tight mb-2">Delete User</h2>
            <p className="text-center text-slate-500 mb-6">
              Are you sure you want to permanently delete <span className="font-semibold text-slate-700">{showDeleteModal.name}</span>? This action cannot be undone.
            </p>
            {showDeleteModal.role === 'admin' && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 mb-4">
                <p className="font-semibold">Warning: Admin Account</p>
                <p className="mt-1">You are about to delete an administrator account.</p>
              </div>
            )}
            <div className="flex gap-3">
              <button 
                onClick={() => setShowDeleteModal(null)}
                className="flex-1 py-2.5 border border-border/60 rounded-xl font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleDeleteUser(showDeleteModal)}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors"
              >
                Delete User
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
