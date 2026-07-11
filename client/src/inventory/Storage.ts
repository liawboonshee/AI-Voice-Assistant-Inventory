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

  return JSON.parse(data)
}


export function saveInventory(data: InventoryData) {
  localStorage.setItem(
    KEY,
    JSON.stringify(data)
  )
}
