export type InventoryData = {
  stock: number
  income: number
  profit: number
  cost: number
}


const KEY = 'inventory_data'


const defaultData: InventoryData = {
  stock: 0,
  income: 0,
  profit: 0,
  cost: 0,
}


export function loadInventory(): InventoryData {

  const data = localStorage.getItem(KEY)

  if (!data) {
    return defaultData
  }


  const result = JSON.parse(data)

  return {
    stock: result.stock || 0,
    income: result.income || 0,
    profit: result.profit || 0,
    cost: result.cost || 0,
  }

}


export function saveInventory(data: InventoryData) {

  localStorage.setItem(
    KEY,
    JSON.stringify(data)
  )

}
