import type { RecordItem } from './Records'

export function recordCashIn(record: RecordItem): number {
  if (record.type === 'purchase') return 0
  if (record.type === 'income') return Math.max(0, record.amount || 0)
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
  if (record.type === 'purchase') return 0
  if (record.type === 'income') {
    return record.note === '客户还款' ? 0 : Math.max(0, record.amount || 0)
  }
  if ((record.weight || 0) <= 0) return 0
  return (record.amount || 0) - (record.costAmount || 0)
}

export function isSameLocalDay(value: string, target = new Date()): boolean {
  const date = new Date(value)
  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === target.getFullYear() &&
    date.getMonth() === target.getMonth() &&
    date.getDate() === target.getDate()
  )
}

export function isSameLocalMonth(value: string, target = new Date()): boolean {
  const date = new Date(value)
  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === target.getFullYear() &&
    date.getMonth() === target.getMonth()
  )
}
