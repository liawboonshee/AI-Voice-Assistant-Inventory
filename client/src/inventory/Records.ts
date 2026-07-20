import type { PaymentMethod } from './Payments'
import { loadInventory, saveInventory } from './Storage'

export type RecordItem = {

  type:'purchase' | 'sale' | 'income' | 'adjustment' | 'debt'

  date:string

  customer?:string

  source?:string

  note?:string

  weight:number

  amount:number

  // 新版记录会保存付款、欠款和本次成本；旧资料没有这些字段也能继续读取。
  debtAmount?:number

  paidAmount?:number

  cashAmount?:number

  transferAmount?:number

  costAmount?:number

  profitAmount?:number

  // 出货收款方式；none 表示只扣库存、没有填写金额。
  paymentMethod?:PaymentMethod

  batchId?:string

  unitCost?:number

  averageCostAfter?:number

  stockAfter?:number

}



const KEY='inventory_records'



export function loadRecords():RecordItem[]{

  const data=localStorage.getItem(KEY)

  if(!data){

    return []

  }

  try {
    const parsed=JSON.parse(data)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }

}



export function saveRecord(item:RecordItem){

  const records=loadRecords()

  records.push(item)

  localStorage.setItem(

    KEY,

    JSON.stringify(records)

  )

}

export function currentRecordDate():string{

  return new Date().toISOString()

}



export function deleteRecord(index:number){

  const records=loadRecords()

  records.splice(index,1)


  localStorage.setItem(

    KEY,

    JSON.stringify(records)

  )

}

type CustomerDebt = { name: string; debt: number; phone?: string }

function round(value:number):number{
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function saleCashIn(item:RecordItem):number{
  if(item.cashAmount !== undefined || item.transferAmount !== undefined){
    return Math.max(0, (item.cashAmount || 0) + (item.transferAmount || 0))
  }
  if(item.paidAmount !== undefined) return Math.max(0, item.paidAmount)
  return Math.max(0, (item.amount || 0) - (item.debtAmount || 0))
}

/** 删除错误的旧出货，并把它对库存、收入、利润及顾客欠款的影响全部撤销。 */
export function deleteSaleAndRestore(index:number):string{
  const records=loadRecords()
  const item=records[index]
  if(!item || item.type !== 'sale') return '找不到这笔出货记录'

  const inventory=loadInventory()
  const restoredWeight=Math.max(0, item.weight || 0)
  const currentAverageCost=inventory.stock > 0
    ? inventory.totalWeightCost / inventory.stock
    : 0
  const restoredCost=item.costAmount !== undefined
    ? Math.max(0, item.costAmount)
    : round(currentAverageCost * restoredWeight)
  const profit=item.profitAmount !== undefined
    ? item.profitAmount
    : (item.amount || 0) - restoredCost

  inventory.stock=round(inventory.stock + restoredWeight)
  inventory.totalWeightCost=round(inventory.totalWeightCost + restoredCost)
  inventory.income=Math.max(0, round(inventory.income - saleCashIn(item)))
  inventory.profit=round(inventory.profit - profit)
  saveInventory(inventory)

  const debtAmount=Math.max(0, item.debtAmount || 0)
  if(debtAmount > 0 && item.customer){
    try{
      const customers:CustomerDebt[]=JSON.parse(localStorage.getItem('customers') || '[]')
      const customer=Array.isArray(customers)
        ? customers.find((entry) => entry.name === item.customer)
        : undefined
      if(customer){
        customer.debt=Math.max(0, round((customer.debt || 0) - debtAmount))
        localStorage.setItem('customers', JSON.stringify(customers))
      }
    }catch{
      // 顾客资料损坏时仍可撤销库存记录，避免整项删除失败。
    }
  }

  records.splice(index,1)
  localStorage.setItem(KEY, JSON.stringify(records))
  return `✅ 已删除旧出货，库存回补${restoredWeight.toFixed(2)}g`
}
