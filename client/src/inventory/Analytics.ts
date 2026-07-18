import type { RecordItem } from './Records'

type DateParts = { year: number; month: number; day: number }

const BUSINESS_TIME_ZONE = 'Asia/Kuala_Lumpur'

function malaysiaDateParts(date: Date): DateParts | null {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: BUSINESS_TIME_ZONE,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(date)
    const year = Number(parts.find((part) => part.type === 'year')?.value)
    const month = Number(parts.find((part) => part.type === 'month')?.value)
    const day = Number(parts.find((part) => part.type === 'day')?.value)
    return validDateParts(year, month, day)
  } catch {
    return validDateParts(date.getFullYear(), date.getMonth() + 1, date.getDate())
  }
}

function validDateParts(year: number, month: number, day: number): DateParts | null {
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? { year, month, day }
    : null
}

function localeUsesDayFirst(): boolean {
  try {
    const parts = new Intl.DateTimeFormat().formatToParts(new Date(2001, 10, 22))
    return parts.findIndex((part) => part.type === 'day') < parts.findIndex((part) => part.type === 'month')
  } catch {
    return true
  }
}

export function recordDateParts(value: string): DateParts | null {
  const text = String(value || '').trim()
  if (!text) return null

  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
    const date = new Date(text)
    return Number.isNaN(date.getTime()) ? null : malaysiaDateParts(date)
  }

  const yearFirst = text.match(/^(\d{4})[年/.\-](\d{1,2})[月/.\-](\d{1,2})/)
  if (yearFirst) return validDateParts(Number(yearFirst[1]), Number(yearFirst[2]), Number(yearFirst[3]))

  const yearLast = text.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})/)
  if (yearLast) {
    const first = Number(yearLast[1])
    const second = Number(yearLast[2])
    const year = Number(yearLast[3])
    if (first > 12) return validDateParts(year, second, first)
    if (second > 12) return validDateParts(year, first, second)
    return localeUsesDayFirst()
      ? validDateParts(year, second, first)
      : validDateParts(year, first, second)
  }

  const date = new Date(text)
  return Number.isNaN(date.getTime())
    ? null
    : { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() }
}

export function recordCashIn(record: RecordItem): number {
  if (record.type === 'purchase') return 0
  if (record.type === 'adjustment' || record.type === 'debt') return 0
  if (record.type === 'income') return Math.max(0, record.amount || 0)
  if (record.cashAmount !== undefined || record.transferAmount !== undefined) {
    return Math.max(0, (record.cashAmount || 0) + (record.transferAmount || 0))
  }
  if (record.paidAmount !== undefined) return Math.max(0, record.paidAmount)
  if (record.paymentMethod === 'debt' || record.paymentMethod === 'none') return 0
  return Math.max(
    0,
    Math.max(0, (record.amount || 0) - (record.debtAmount || 0)),
  )
}

export function recordCashOut(record: RecordItem): number {
  return record.type === 'purchase' ? Math.max(0, record.amount || 0) : 0
}

export function recordProfit(record: RecordItem): number {
  if (record.profitAmount !== undefined) return record.profitAmount
  if (record.type === 'purchase' || record.type === 'adjustment' || record.type === 'debt') return 0
  if (record.type === 'income') {
    return record.note === '客户还款' ? 0 : Math.max(0, record.amount || 0)
  }
  if ((record.weight || 0) <= 0) return 0
  return (record.amount || 0) - (record.costAmount || 0)
}

export function isSameLocalDay(value: string, target = new Date()): boolean {
  const date = recordDateParts(value)
  const targetParts = malaysiaDateParts(target)
  return (
    date !== null &&
    targetParts !== null &&
    date.year === targetParts.year &&
    date.month === targetParts.month &&
    date.day === targetParts.day
  )
}

export function isSameLocalMonth(value: string, target = new Date()): boolean {
  const date = recordDateParts(value)
  const targetParts = malaysiaDateParts(target)
  return (
    date !== null &&
    targetParts !== null &&
    date.year === targetParts.year &&
    date.month === targetParts.month
  )
}

export function formatBusinessDate(target = new Date()): string {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: BUSINESS_TIME_ZONE,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).format(target)
  } catch {
    return target.toLocaleDateString('zh-CN')
  }
}

export function formatRecordDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('zh-CN', { timeZone: BUSINESS_TIME_ZONE })
}
