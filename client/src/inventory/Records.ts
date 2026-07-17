import type { PaymentMethod } from './Payments'

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
