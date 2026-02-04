const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'
const trimmedApiUrl = rawApiUrl.trim()

const normalizeApiBase = (value: string) => {
  const cleaned = value.replace(/\/$/, '')
  const apiMatch = cleaned.match(/\/api(\/|$)/i)
  return apiMatch ? `${cleaned.slice(0, apiMatch.index)}/api` : `${cleaned}/api`
}

const withProtocol = (() => {
  const normalizedInput = trimmedApiUrl.replace(/^\/+/, '/')

  if (normalizedInput.startsWith('//')) {
    return normalizeApiBase(`https:${normalizedInput}`)
  }

  if (normalizedInput.startsWith('/')) {
    const withoutLeadingSlash = normalizedInput.slice(1)
    if (/^[^/]+\.[^/]+/.test(withoutLeadingSlash)) {
      return normalizeApiBase(`https://${withoutLeadingSlash}`)
    }
    return normalizeApiBase(normalizedInput)
  }

  if (/^https?:\/\//i.test(normalizedInput)) {
    return normalizeApiBase(normalizedInput)
  }

  if (/^(localhost|127\.0\.0\.1)/i.test(normalizedInput)) {
    return normalizeApiBase(`http://${normalizedInput}`)
  }

  return normalizeApiBase(`https://${normalizedInput}`)
})()

export const apiBaseUrl = withProtocol
export const socketBaseUrl = apiBaseUrl.replace(/\/api$/, '')
