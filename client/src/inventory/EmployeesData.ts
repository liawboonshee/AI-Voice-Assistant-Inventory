import { recordCashAmount, recordCashIn, recordTransferAmount } from './Analytics.ts'
import { PACKS, emptyPacks, packsWeight, validPacks, type PackCounts } from './Packs.ts'
import type { RecordItem } from './Records'

export type Employee = { id: string; name: string }
export const EMPLOYEES_KEY = 'inventory_employees_v1'
export function loadEmployees(): Employee[] {
  const raw = JSON.parse(localStorage.getItem(EMPLOYEES_KEY) || '[]')
  if (!Array.isArray(raw)) throw new Error('员工资料无法读取，请先恢复备份')
  return raw
}
export function addEmployee(name: string): Employee {
  const employees = loadEmployees()
  const clean = name.trim()
  if (!clean) throw new Error('请填写员工名字')
  if (employees.some(e => e.name === clean)) throw new Error('这个员工名字已存在')
  const employee = { id: crypto.randomUUID(), name: clean }
  localStorage.setItem(EMPLOYEES_KEY, JSON.stringify([...employees, employee]))
  return employee
}
const units = (weight: number) => Math.round(weight * 100)
export function employeeStock(records: RecordItem[], employeeId: string): number {
  return records.reduce((sum, item) => {
    if (item.employeeId !== employeeId) return sum
    if (item.employeeMovement === 'give') return sum + units(item.weight)
    if (item.employeeMovement === 'return' || item.type === 'sale') return sum - units(item.weight)
    return sum
  }, 0) / 100
}
export function heldStock(records: RecordItem[]): number {
  const ids = new Set(records.map(item => item.employeeId).filter((id): id is string => !!id))
  return [...ids].reduce((sum, id) => sum + units(employeeStock(records, id)), 0) / 100
}
export function ownerStock(totalStock: number, records: RecordItem[]): number {
  return (units(totalStock) - units(heldStock(records))) / 100
}
export function stockError(total: number, records: RecordItem[], weight: number, employeeId = ''): string | null {
  if (!Number.isFinite(weight) || units(weight) < 1) return '重量最少0.01G'
  const available = employeeId ? employeeStock(records, employeeId) : ownerStock(total, records)
  if (units(weight) > units(available)) return `${employeeId ? '员工' : '你手里'}库存不足，目前只有${available.toFixed(2)}G`
  if (units(weight) > units(total)) return '总库存不足，请先核对库存'
  return null
}

export function employeePacks(records: RecordItem[], employeeId: string): PackCounts {
  const result = emptyPacks()
  for (const item of records) {
    if (item.employeeId !== employeeId || !validPacks(item.packCounts)) continue
    const direction = item.employeeMovement === 'give' ? 1 : item.employeeMovement === 'return' || item.type === 'sale' ? -1 : 0
    for (const pack of PACKS) result[pack.key] += direction * item.packCounts[pack.key]
  }
  return result
}
export function employeePackError(records: RecordItem[], employeeId: string, requested: PackCounts): string | null {
  const available = employeePacks(records, employeeId)
  if (!validPacks(requested) || packsWeight(requested) <= 0) return '请至少填写1个货品，数量必须是整数'
  for (const pack of PACKS) {
    if (requested[pack.key] > available[pack.key]) return `${pack.label}数量不足，员工手里只剩${available[pack.key]}个`
  }
  return null
}
export function employeeUnsortedWeight(records: RecordItem[], employeeId: string): number {
  return Math.max(0, Math.round((employeeStock(records, employeeId) - packsWeight(employeePacks(records, employeeId))) * 100) / 100)
}

/** Cumulative package and sale totals; transfers and repayments are not sales. */
export function employeeSummary(records: RecordItem[], employeeId: string) {
  const remaining = employeePacks(records, employeeId)
  const sold = emptyPacks()
  let amountCents = 0, receivedCents = 0, debtCents = 0, cashCents = 0, transferCents = 0, legacyUnits = 0
  const cents = (value: number) => Number.isFinite(value) ? Math.round((Math.max(0, value) + Number.EPSILON) * 100) : 0
  for (const item of records) {
    if (item.employeeId !== employeeId || item.type !== 'sale') continue
    if (validPacks(item.packCounts)) {
      for (const pack of PACKS) sold[pack.key] += item.packCounts[pack.key]
    } else { legacyUnits += units(item.weight || 0) }
    amountCents += cents(item.amount || 0)
    receivedCents += cents(recordCashIn(item))
    cashCents += cents(recordCashAmount(item))
    transferCents += cents(recordTransferAmount(item))
    debtCents += cents(item.debtAmount || 0)
  }
  return {
    remaining, sold,
    remainingCount: Object.values(remaining).reduce((a, b) => a + b, 0),
    soldCount: Object.values(sold).reduce((a, b) => a + b, 0),
    salesAmount: amountCents / 100,
    receivedAtSale: receivedCents / 100,
    cashAtSale: cashCents / 100,
    transferAtSale: transferCents / 100,
    debtAtSale: debtCents / 100,
    legacySaleWeight: legacyUnits / 100,
  }
}
export type EmployeeSummary = ReturnType<typeof employeeSummary>
