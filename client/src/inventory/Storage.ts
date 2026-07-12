export type SaleRecord = {
  customer: string
  weight: number
  price: number
  total: number
  date: string
}


export type InventoryData = {

  stock: number

  income: number

  profit: number

  cost: number

  sales: SaleRecord[]

}


const KEY = 'inventory_data'


const defaultData: InventoryData = {

  stock: 0,

  income: 0,

  profit: 0,

  cost: 0,

  sales: []

}


export function loadInventory(): InventoryData {

  const data = localStorage.getItem(KEY)


  if (!data) {

    return defaultData

  }


  const result = JSON.parse(data)


  // 防止旧数据没有 sales

  if (!result.sales) {

    result.sales = []

  }


  return result

}



export function saveInventory(data: InventoryData) {

  localStorage.setItem(

    KEY,

    JSON.stringify(data)

  )

}
