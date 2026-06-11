import dayjs from 'dayjs'

export const NEAR_EXPIRY_DAYS = 30

export function isExpired(expireDate: string | null): boolean {
  if (!expireDate) return false
  return dayjs(expireDate).isBefore(dayjs(), 'day')
}

export function isNearExpiry(expireDate: string | null): boolean {
  if (!expireDate) return false
  if (isExpired(expireDate)) return false
  const daysDiff = dayjs(expireDate).diff(dayjs(), 'day')
  return daysDiff <= NEAR_EXPIRY_DAYS
}

export function formatDate(date: string | Date | null): string {
  if (!date) return '-'
  return dayjs(date).format('YYYY-MM-DD')
}

export function formatDateTime(date: string | Date | null): string {
  if (!date) return '-'
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

export function today(): string {
  return dayjs().format('YYYY-MM-DD')
}

export function getDaysUntilExpiry(expireDate: string | null): number {
  if (!expireDate) return Infinity
  return dayjs(expireDate).diff(dayjs(), 'day')
}
