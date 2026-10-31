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
