import assert from 'node:assert/strict'
import test from 'node:test'
import { employeeStock, heldStock, ownerStock, stockError, addEmployee, loadEmployees } from '../src/inventory/EmployeesData.ts'
import { createBackup, restoreBackup } from '../src/inventory/BackupData.ts'
class MemoryStorage {
  values = new Map()
  getItem(key) { return this.values.get(key) ?? null }
  setItem(key, value) { this.values.set(key, value) }
  removeItem(key) { this.values.delete(key) }
}
const record = (employeeId, weight, movement) => ({type: movement ? 'adjustment' : 'sale', employeeId, weight, employeeMovement: movement, date:'2026-10-31T08:00:00Z',amount:0})
test('two employees, partial sales and returns preserve owner plus held equals total', () => {
  const records = [record('a', 30, 'give'), record('b', 20, 'give'), record('a', 5), record('b', 0.01), record('a', 2, 'return')]
  const total = 94.99
  assert.equal(employeeStock(records, 'a'),23)
  assert.equal(employeeStock(records, 'b'),19.99)
  assert.equal(heldStock(records),42.99)
  assert.equal(ownerStock(total,records),52)
  assert.equal(Math.round((ownerStock(total,records)+heldStock(records))*100),9499)
})
test('owner and employee cannot sell or return another person’s inventory', () => {
  const records = [record('a',80,'give')]
  assert.match(stockError(100,records,20.01),/库存不足/)
  assert.match(stockError(100,records,80.01,'a'),/员工库存不足/)
  assert.match(stockError(100,records,0.01,'b'),/库存不足/)
  assert.equal(stockError(100,records,20),null)
  assert.equal(stockError(100,records,80,'a'),null)
  for (const weight of [0,-1,NaN,Infinity]) assert.ok(stockError(100,records,weight))
})
test('hundred 0.01G sales consume exactly one gram', () => {
  const records = [record('a',1,'give'),...Array.from({length:100},()=>record('a',0.01))]
  assert.equal(employeeStock(records,'a'),0)
  assert.equal(heldStock(records),0)
  assert.equal(ownerStock(99,records),99)
})
test('deleting employee sale restores that employee stock without changing owner stock', () => {
  const give=record('a',30,'give'), sale=record('a',5)
  assert.equal(ownerStock(95,[give,sale]),70)
  assert.equal(ownerStock(100,[give]),70)
  assert.equal(employeeStock([give],'a'),30)
})
test('employee identities stay separate, duplicate names rejected, no destructive employee deletion', () => {
  globalThis.localStorage=new MemoryStorage()
  const a=addEmployee(' 阿明 '), b=addEmployee('阿华')
  assert.notEqual(a.id,b.id)
  assert.equal(a.name,'阿明')
  assert.throws(()=>addEmployee('阿明'),/已存在/)
  assert.throws(()=>addEmployee(' '),/名字/)
  assert.equal(loadEmployees().length,2)
})
test('backup and restore includes employees and their transfers/sales, legacy clears stale employees', () => {
  const source=new MemoryStorage()
  source.setItem('inventory_employees_v1',JSON.stringify([{id:'a',name:'阿明'}]))
  source.setItem('inventory_records',JSON.stringify([record('a',20,'give'),record('a',5)]))
  const backup=createBackup(source), target=new MemoryStorage()
  restoreBackup(target,JSON.stringify(backup))
  assert.equal(target.getItem('inventory_employees_v1'),source.getItem('inventory_employees_v1'))
  assert.equal(employeeStock(JSON.parse(target.getItem('inventory_records')),'a'),15)
  delete backup.employees
  restoreBackup(target,JSON.stringify(backup))
  assert.equal(target.getItem('inventory_employees_v1'),null)
})
