'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { initFirebaseAuth, isFirebaseEnabled } from './firebase'
import type { Auth, User as FirebaseUser } from 'firebase/auth'
import api from './api'
import { io, Socket } from 'socket.io-client'
import { User, Notification } from '@/lib/types'

interface AuthContextType {
  user: User | null
  loading: boolean
  notifications: Notification[]
  unreadCount: number
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  fetchNotifications: () => Promise<void>
  markNotificationsRead: (id?: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [socket, setSocket] = useState<Socket | null>(null)
  const [firebaseAuth, setFirebaseAuth] = useState<Auth | null>(null)
  const [firebaseError, setFirebaseError] = useState<Error | null>(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    let active = true

    if (!isFirebaseEnabled) {
      setFirebaseError(new Error('Firebase authentication is disabled.'))
      setLoading(false)
      setAuthReady(true)
      return () => {
        active = false
      }
    }

    initFirebaseAuth().then(({ auth, firebaseInitError }) => {
      if (!active) return
      setFirebaseAuth(auth)
      setFirebaseError(firebaseInitError)
      setAuthReady(true)
      if (!auth || firebaseInitError) {
        setLoading(false)
      }
    })

    return () => {
      active = false
    }
  }, [])

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get('/notifications')
      const data = res.data
      setNotifications(data)
      setUnreadCount(data.filter((n: Notification) => !n.isRead).length)
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
    }
  }, [])

  const syncUserWithBackend = useCallback(async () => {
    try {
      const res = await api.get('/auth/me')
      setUser(res.data)
    } catch (error) {
      console.error('Failed to sync user with backend:', error)
    }
  }, [])

  useEffect(() => {
    if (!authReady || !firebaseAuth) return

    let unsubscribe: (() => void) | null = null

    const setupAuthListener = async () => {
      const { onAuthStateChanged } = await import('firebase/auth')
      
      unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser: FirebaseUser | null) => {
        if (firebaseUser) {
          await syncUserWithBackend()
          fetchNotifications()
          
          const newSocket = io(process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000')
          newSocket.emit('join', firebaseUser.uid)
          
          newSocket.on('notification', (notification) => {
            setNotifications(prev => [notification, ...prev])
            setUnreadCount(prev => prev + 1)
          })

          setSocket(newSocket)
        } else {
          setUser(null)
          setNotifications([])
          setUnreadCount(0)
          socket?.disconnect()
          setSocket(null)
        }
        setLoading(false)
      })
    }

    setupAuthListener()

    return () => {
      unsubscribe?.()
      socket?.disconnect()
    }
  }, [authReady, firebaseAuth, syncUserWithBackend, fetchNotifications])

  const login = useCallback(async (email: string, password: string) => {
    if (!firebaseAuth) throw new Error('Firebase not initialized')
    const { signInWithEmailAndPassword } = await import('firebase/auth')
    await signInWithEmailAndPassword(firebaseAuth, email, password)
    await syncUserWithBackend()
  }, [firebaseAuth, syncUserWithBackend])

  const logout = useCallback(async () => {
    if (!firebaseAuth) return
    const { signOut } = await import('firebase/auth')
    await signOut(firebaseAuth)
  }, [firebaseAuth])

  const markNotificationsRead = useCallback(async (id?: string) => {
    try {
      if (id) {
        await api.patch(`/notifications/${id}/read`)
      } else {
        await api.post('/notifications/read-all')
      }
      await fetchNotifications()
    } catch (error) {
      console.error('Failed to mark notifications:', error)
    }
  }, [fetchNotifications])

  if (!authReady) {
    return (
      <AuthContext.Provider
        value={{
          user: null,
          loading: true,
          notifications: [],
          unreadCount: 0,
          login: async () => { throw new Error('Auth initializing') },
          logout: async () => {},
          fetchNotifications: async () => {},
          markNotificationsRead: async () => {},
        }}
      >
        {children}
      </AuthContext.Provider>
    )
  }

  if (firebaseError || !firebaseAuth) {
    const message = firebaseError?.message || 'Firebase authentication is not configured.'
    const fail = async () => {
      throw new Error(message)
    }

    return (
      <AuthContext.Provider
        value={{
          user: null,
          loading: false,
          notifications: [],
          unreadCount: 0,
          login: fail,
          logout: async () => {},
          fetchNotifications: async () => {},
          markNotificationsRead: async () => {},
        }}
      >
        {children}
      </AuthContext.Provider>
    )
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        notifications,
        unreadCount,
        login,
        logout,
        fetchNotifications,
        markNotificationsRead,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
