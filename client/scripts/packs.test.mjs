import assert from 'node:assert/strict'
import test from 'node:test'
import { PACKS, emptyPacks, emptyPackInputs, parsePacks, packsWeight, packSummary, validPacks } from '../src/inventory/Packs.ts'
import { employeeSummary, employeePacks, employeePackError, employeeStock, employeeUnsortedWeight, ownerStock } from '../src/inventory/EmployeesData.ts'
import { createBackup, restoreBackup, parseBackup } from '../src/inventory/BackupData.ts'
const packs = (values = {}) => ({...emptyPacks(),...values})
const item = (employeeId, quantities, action) => ({ employeeId, packCounts: quantities, weight: packsWeight(quantities), date: '2026-10-31T08:00:00Z', amount: 0, type: action === 'sale' ? 'sale' : 'adjustment', ...(action === 'sale' ? {} : {employeeMovement:action}) })
class MemoryStorage {
  values=new Map()
  getItem(key){ return this.values.get(key) ?? null }
  setItem(key,value){this.values.set(key,value)}
  removeItem(key){this.values.delete(key)}
}
test('all six exact pack sizes are available and calculate in hundredths of a gram',()=>{
  assert.deepEqual(PACKS.map(p=>p.units),[100,53,40,25,250,625])
  const quantities=packs({g1:2,g053:3,g040:4,g025:5,g250:2,g625:1})
  assert.equal(packsWeight(quantities),17.69)
  assert.equal(packsWeight(packs({g053:100})),53)
  assert.match(packSummary(quantities),/6.25 G × 1个/)
})
test('empty counts mean zero; fractions, negative, nonfinite and excessive counts rejected',()=>{
  assert.deepEqual(parsePacks(emptyPackInputs()),emptyPacks())
  for(const value of ['-1','1.5','Infinity','NaN','1000001']) {
    assert.throws(()=>parsePacks({...emptyPackInputs(),g625:value}),/整数/)
  }
  assert.equal(validPacks(packs({g625:0.5})),false)
  assert.equal(validPacks({g1:2}),false)
})
test('different employees consume only the correct size, including 2.5G and 6.25G',()=>{
  const aGive=packs({g1:10,g053:4,g040:5,g025:3,g250:3,g625:2})
  const records=[item('a',aGive,'give'),item('b',packs({g625:8}),'give'),item('a',packs({g625:1,g250:2,g053:1}),'sale'),item('a',packs({g1:3,g025:1}),'return')]
  assert.deepEqual(employeePacks(records,'a'),packs({g1:7,g053:3,g040:5,g025:2,g250:1,g625:1}))
  assert.equal(employeePacks(records,'b').g625,8)
  assert.equal(employeeUnsortedWeight(records,'a'),0)
  assert.equal(employeePackError(records,'a',packs({g625:1})),null)
  assert.match(employeePackError(records,'a',packs({g625:2})),/6.25 G数量不足/)
  // Total weight is sufficient, but that particular package size is unavailable.
  assert.match(employeePackError(records,'b',packs({g1:1})),/1 G数量不足/)
  assert.ok(employeePackError(records,'a',emptyPacks()))
})
test('removing an employee sale restores exactly its pack sizes, not owner inventory',()=>{
 const give=item('a',packs({g625:3,g250:2}),'give'), sale=item('a',packs({g625:1,g250:1}),'sale')
 const before=ownerStock(100-packsWeight(sale.packCounts),[give,sale])
 const after=ownerStock(100,[give])
 assert.equal(before,after)
 assert.deepEqual(employeePacks([give],'a'),packs({g625:3,g250:2}))
})
test('legacy gram-only records stay unclassified and can be returned without inventing counts',()=>{
 const old={employeeId:'a',employeeMovement:'give',type:'adjustment',weight:10,amount:0,date:'old'}
 const records=[old,item('a',packs({g625:2}),'give')]
 assert.equal(employeeStock(records,'a'),22.5)
 assert.equal(employeeUnsortedWeight(records,'a'),10)
 assert.equal(employeePacks(records,'a').g625,2)
 const back={...old,employeeMovement:'return'}
 assert.equal(employeeUnsortedWeight([...records,back],'a'),0)
 assert.equal(employeePacks([...records,back],'a').g625,2)
})
test('backup round trip preserves every pack count; mismatched or fractional counts cannot restore',()=>{
 const storage=new MemoryStorage(), target=new MemoryStorage()
 storage.setItem('inventory_records',JSON.stringify([item('a',packs({g625:3,g250:2,g053:7}),'give')]))
 const backup=createBackup(storage)
 restoreBackup(target,JSON.stringify(backup))
 assert.equal(target.getItem('inventory_records'),storage.getItem('inventory_records'))
 const mismatched={...backup,records:JSON.stringify([{...item('a',packs({g625:1}),'give'),weight:1}])}
 assert.throws(()=>parseBackup(JSON.stringify(mismatched)),/规格数量与重量不一致/)
 const fractional={...backup,records:JSON.stringify([{...item('a',packs({g625:1}),'give'),packCounts:packs({g625:1.5})}])}
 assert.throws(()=>parseBackup(JSON.stringify(fractional)),/规格数量与重量不一致/)
})

test('employee summary shows pieces remaining, pieces sold and total sale value, keeping cash and debt separate',()=>{
  const give=item('a',packs({g1:10,g053:4,g040:2,g025:4,g250:3,g625:2}),'give')
  const sale={...item('a',packs({g1:2,g053:1,g250:1,g625:1}),'sale'),amount:1000,paidAmount:700,debtAmount:300}
  const returned=item('a',packs({g1:1,g025:2}),'return')
  const other={...item('b',packs({g625:3}),'sale'),amount:9999,paidAmount:9999}
  const repayment={employeeId:'a',type:'income',weight:0,amount:300,paidAmount:300,note:'客户还款',date:'later'}
  const summary=employeeSummary([give,sale,returned,other,repayment],'a')
  assert.equal(summary.remainingCount,17)
  assert.equal(summary.soldCount,5)
  assert.equal(summary.salesAmount,1000)
  assert.equal(summary.receivedAtSale,700)
  assert.equal(summary.debtAtSale,300)
  assert.equal(summary.remaining.g625,1)
  assert.equal(summary.sold.g625,1)
  const reversed=employeeSummary([give,returned,other],'a')
  assert.equal(reversed.remainingCount,22)
  assert.equal(reversed.soldCount,0)
  assert.equal(reversed.salesAmount,0)
})
test('summary retains legacy sale money without guessing counts, sums currency exactly',()=>{
  const legacy={employeeId:'a',type:'sale',weight:2.5,amount:0.1,paidAmount:0.1,date:'old'}
  const sale={...item('a',packs({g025:2}),'sale'),amount:0.2,paidAmount:0.2}
  const summary=employeeSummary([legacy,sale],'a')
  assert.equal(summary.salesAmount,0.3)
  assert.equal(summary.receivedAtSale,0.3)
  assert.equal(summary.soldCount,2)
  assert.equal(summary.legacySaleWeight,2.5)
})
