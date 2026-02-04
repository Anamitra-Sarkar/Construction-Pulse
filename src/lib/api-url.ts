// Get the API URL from environment variable or fallback to localhost
const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'
const trimmedApiUrl = rawApiUrl.trim()

/**
 * Normalizes the API base URL by ensuring it ends with /api
 * 
 * Handles the following cases:
 * - Removes trailing slashes from the input
 * - Case-insensitive detection of existing /api suffix (matches /api, /API, /Api, etc.)
 * - Prevents duplicate /api paths (e.g., "http://example.com/api/api" becomes "http://example.com/api")
 * - Appends /api if not present
 * 
 * Examples:
 * - "http://example.com" → "http://example.com/api"
 * - "http://example.com/" → "http://example.com/api"
 * - "http://example.com/api" → "http://example.com/api"
 * - "http://example.com/API/" → "http://example.com/api"
 */
const normalizeApiBase = (value: string) => {
  const cleaned = value.replace(/\/$/, '')
  const apiMatch = cleaned.match(/\/api(\/|$)/i)
  return apiMatch ? `${cleaned.slice(0, apiMatch.index)}/api` : `${cleaned}/api`
}

/**
 * Processes the API URL and ensures it has the correct protocol
 * 
 * This function handles various URL formats and edge cases:
 * 1. Protocol-relative URLs (//example.com) → https://example.com/api
 * 2. Slash-prefixed domains (/example.com) → https://example.com/api
 * 3. Slash-prefixed paths (/api) → /api (stays relative for same-origin requests)
 * 4. URLs with existing protocol (http://example.com) → http://example.com/api
 * 5. localhost URLs (localhost:3000) → http://localhost:3000/api
 * 6. Bare domains (example.com) → https://example.com/api
 */
const withProtocol = (() => {
  // Normalize multiple leading slashes to a single slash
  // e.g., "///example.com" → "/example.com"
  const normalizedInput = trimmedApiUrl.replace(/^\/+/, '/')

  // Handle protocol-relative URLs like "//example.com" or "//api.example.com"
  // These are treated as HTTPS URLs for security
  if (normalizedInput.startsWith('//')) {
    return normalizeApiBase(`https:${normalizedInput}`)
  }

  // Handle slash-prefixed inputs
  if (normalizedInput.startsWith('/')) {
    const withoutLeadingSlash = normalizedInput.slice(1)
    
    // Check if it looks like a domain (contains at least one dot between non-slash characters)
    // e.g., "/example.com" or "/api.example.com" → treated as domains
    // This regex matches patterns like "example.com" or "sub.example.com"
    if (/^[^/]+\.[^/]+/.test(withoutLeadingSlash)) {
      return normalizeApiBase(`https://${withoutLeadingSlash}`)
    }
    
    // Otherwise, treat as a relative path (e.g., "/api" stays as "/api")
    // This allows same-origin requests without hardcoding the domain
    return normalizeApiBase(normalizedInput)
  }

  // Handle URLs that already have a protocol (http:// or https://)
  // Keep the existing protocol as specified
  if (/^https?:\/\//i.test(normalizedInput)) {
    return normalizeApiBase(normalizedInput)
  }

  // Handle localhost URLs (localhost or 127.0.0.1)
  // Use HTTP instead of HTTPS since localhost typically doesn't have SSL
  // Matches: localhost, localhost:3000, 127.0.0.1, 127.0.0.1:5000
  if (/^(localhost|127\.0\.0\.1)/i.test(normalizedInput)) {
    return normalizeApiBase(`http://${normalizedInput}`)
  }

  // Default case: treat as a bare domain and use HTTPS
  // e.g., "example.com" → "https://example.com/api"
  return normalizeApiBase(`https://${normalizedInput}`)
})()

// Export the normalized API base URL for HTTP requests
export const apiBaseUrl = withProtocol

// Export the socket base URL (removes /api suffix for WebSocket connections)
export const socketBaseUrl = apiBaseUrl.replace(/\/api$/, '')
