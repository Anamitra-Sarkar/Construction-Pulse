import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getTokenFromHeader } from '@/lib/auth'

type RouteHandler = (
  request: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => Promise<NextResponse>

export function withAuth(
  handler: (
    request: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: { id: string; email: string; role: 'admin' | 'engineer'; name: string }
  ) => Promise<NextResponse>,
  allowedRoles?: ('admin' | 'engineer')[]
): RouteHandler {
  return async (request: NextRequest, context: { params: Promise<Record<string, string>> }) => {
    const token = getTokenFromHeader(request.headers.get('authorization'))

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const session = await verifyToken(token)

    if (!session) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    if (allowedRoles && !allowedRoles.includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    return handler(request, context, session.user)
  }
}
