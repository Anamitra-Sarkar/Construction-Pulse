/**
 * Safe utility functions for defensive data handling
 * Prevents runtime errors from unexpected API response shapes
 */

/**
 * Ensures a value is always returned as an array
 * @param value - The value to convert to an array
 * @returns An array, or empty array if value is not array-like
 */
export function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value
  }
  return []
}

/**
 * Safely converts a value to a number with fallback
 * @param value - The value to convert
 * @param fallback - The fallback value if conversion fails
 * @returns A valid number or the fallback
 */
export function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && !isNaN(value) && isFinite(value)) {
    return value
  }
  const parsed = Number(value)
  if (!isNaN(parsed) && isFinite(parsed)) {
    return parsed
  }
  return fallback
}

/**
 * Safely converts a value to a valid Date
 * @param value - The value to convert
 * @param fallback - The fallback date if conversion fails
 * @returns A valid Date object
 */
export function asDate(value: unknown, fallback?: Date): Date {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value)
    if (!isNaN(date.getTime())) {
      return date
    }
  }
  return fallback || new Date()
}

/**
 * Safely extracts string value with fallback
 * @param value - The value to convert
 * @param fallback - The fallback string
 * @returns A string value
 */
export function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    return value
  }
  if (value === null || value === undefined) {
    return fallback
  }
  return String(value)
}

/**
 * Normalizes API response data with safe defaults
 * @param data - The API response data
 * @returns Normalized data object
 */
export function normalizeApiResponse<T extends Record<string, any>>(
  data: unknown,
  defaults: T
): T {
  if (!data || typeof data !== 'object') {
    return defaults
  }
  
  const normalized = { ...defaults }
  
  for (const key in defaults) {
    if (key in (data as any)) {
      const value = (data as any)[key]
      const defaultValue = defaults[key]
      
      if (Array.isArray(defaultValue)) {
        normalized[key] = asArray(value) as any
      } else if (typeof defaultValue === 'number') {
        normalized[key] = asNumber(value, defaultValue) as any
      } else if (typeof defaultValue === 'string') {
        normalized[key] = asString(value, defaultValue) as any
      } else if (defaultValue instanceof Date) {
        normalized[key] = asDate(value, defaultValue) as any
      } else {
        normalized[key] = value ?? defaultValue
      }
    }
  }
  
  return normalized
}
