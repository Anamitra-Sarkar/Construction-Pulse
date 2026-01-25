import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcrypt'
import { User, AuthSession } from './types'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'construction-quality-pulse-secret-key-2024-secure'
)

const TOKEN_EXPIRY = 24 * 60 * 60

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function createToken(user: User): Promise<string> {
  const token = await new SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_EXPIRY}s`)
    .sign(JWT_SECRET)
  
  return token
}

export async function verifyToken(token: string): Promise<AuthSession | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    
    if (!payload.sub || !payload.email || !payload.role) {
      return null
    }

    return {
      user: {
        id: payload.sub as string,
        email: payload.email as string,
        name: payload.name as string,
        role: payload.role as 'admin' | 'engineer',
        created_at: '',
        updated_at: '',
      },
      token,
      expires_at: (payload.exp || 0) * 1000,
    }
  } catch {
    return null
  }
}

export function getTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }
  return authHeader.slice(7)
}
