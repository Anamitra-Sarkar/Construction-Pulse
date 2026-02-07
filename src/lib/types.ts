export interface User {
  _id: string
  firebaseUid: string
  email: string
  name: string
  role: 'admin' | 'engineer'
  status: 'active' | 'inactive'
  createdAt: string
}

export interface Site {
  _id: string
  name: string
  location: string
  status: 'on-track' | 'delayed' | 'completed' | 'on_hold'
  assignedEngineers: User[]
  description?: string
  complianceScore: number
  createdAt: string
  updatedAt: string
}

export interface ChecklistItem {
  item: string
  status: 'pass' | 'fail' | 'n/a'
  comments?: string
}

export interface QAReport {
  _id: string
  site: Site | string
  engineer: User | string
  checklist: ChecklistItem[]
  photos: string[]
  complianceScore: number
  status: 'pending' | 'approved' | 'rejected'
  adminFeedback?: string
  submittedAt: string
  reviewedAt?: string
}

export interface Notification {
  _id: string
  recipient: string
  message: string
  type: 'assignment' | 'report_submitted' | 'report_approved' | 'report_rejected'
  isRead: boolean
  link: string
  createdAt: string
}

export interface AuditLog {
  _id: string
  user: User
  action: string
  details: any
  timestamp: string
}

export const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { item: 'Foundation alignment verified', status: 'n/a' },
  { item: 'Concrete quality checked', status: 'n/a' },
  { item: 'Rebar placement inspected', status: 'n/a' },
  { item: 'Column verticality verified', status: 'n/a' },
  { item: 'Beam connections inspected', status: 'n/a' },
  { item: 'Load-bearing walls checked', status: 'n/a' },
  { item: 'Wiring standards compliance', status: 'n/a' },
  { item: 'Grounding verified', status: 'n/a' },
  { item: 'Panel installation checked', status: 'n/a' },
  { item: 'Pipe joints inspected', status: 'n/a' },
  { item: 'Water pressure tested', status: 'n/a' },
  { item: 'Drainage slope verified', status: 'n/a' },
  { item: 'Fire exits accessible', status: 'n/a' },
  { item: 'Safety equipment in place', status: 'n/a' },
  { item: 'Hazard signs posted', status: 'n/a' },
  { item: 'Surface finish quality', status: 'n/a' },
  { item: 'Paint/coating application', status: 'n/a' },
  { item: 'Material specifications met', status: 'n/a' },
]

export interface AnalyticsSummary {
  overview: {
    totalSites: number
    totalReports: number
    approvedReports: number
    avgCompliance: number
  }
  dailyTrends: {
    _id: string
    count: number
    avgCompliance: number
  }[]
  totalSites: number
  totalReports: number
  activeSites: number
  pendingReports: number
  approvedReports: number
  rejectedReports: number
  averageCompliance: number
}

export interface DailyTrend {
  _id: string
  date: string
  count: number
  avgCompliance: number
}

export interface SiteComparison {
  site_id: string
  site_name: string
  report_count: number
  avg_compliance: number
}
