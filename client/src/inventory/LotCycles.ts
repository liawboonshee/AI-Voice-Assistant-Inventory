import type { InventoryData } from './Storage'

export type LotCycle = {
  id: string
  sequence: number
  status: 'active' | 'closed'
  startedAt: string
  closedAt?: string
  closeReason?: 'sold_out' | 'new_purchase' | 'stock_adjustment'
  source: string
  openingWeight: number
  openingCost: number
  purchaseWeight: number
  purchaseCost: number
  startingWeight: number
  startingCost: number
  soldWeight: number
  salesAmount: number
  receivedIncome: number
  cashIncome: number
  transferIncome: number
  debtAmount: number
  saleCost: number
  profit: number
  remainingWeight: number
  remainingCost: number
}

type PurchaseInput = {
  date: string
  source?: string
  weight: number
  cost: number
}

type SaleInput = {
  date: string
  weight: number
  amount: number
  paidAmount: number
  cashAmount: number
  transferAmount: number
  debtAmount: number
  costAmount: number
  profitAmount: number
  stockAfter: number
  costAfter: number
}

const KEY = 'inventory_lot_cycles_v1'

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function createLegacyCycle(inventory: InventoryData): LotCycle | null {
  if (inventory.stock <= 0) return null
  const now = new Date().toISOString()
  return {
    id: `LOT-LEGACY-${Date.now()}`,
    sequence: 1,
    status: 'active',
    startedAt: now,
    source: '升级前库存',
    openingWeight: round(inventory.stock),
    openingCost: round(inventory.totalWeightCost),
    purchaseWeight: 0,
    purchaseCost: 0,
    startingWeight: round(inventory.stock),
    startingCost: round(inventory.totalWeightCost),
    soldWeight: 0,
    salesAmount: 0,
    receivedIncome: 0,
    cashIncome: 0,
    transferIncome: 0,
    debtAmount: 0,
    saleCost: 0,
    profit: 0,
    remainingWeight: round(inventory.stock),
    remainingCost: round(inventory.totalWeightCost),
  }
}

function normalizeCycle(value: Partial<LotCycle>): LotCycle | null {
  if (!value.id || !Number.isFinite(Number(value.sequence))) return null
  return {
    id: String(value.id),
    sequence: Number(value.sequence),
    status: value.status === 'closed' ? 'closed' : 'active',
    startedAt: String(value.startedAt || new Date().toISOString()),
    closedAt: value.closedAt ? String(value.closedAt) : undefined,
    closeReason: value.closeReason,
    source: String(value.source || '未填写'),
    openingWeight: round(Number(value.openingWeight || 0)),
    openingCost: round(Number(value.openingCost || 0)),
    purchaseWeight: round(Number(value.purchaseWeight || 0)),
    purchaseCost: round(Number(value.purchaseCost || 0)),
    startingWeight: round(Number(value.startingWeight || 0)),
    startingCost: round(Number(value.startingCost || 0)),
    soldWeight: round(Number(value.soldWeight || 0)),
    salesAmount: round(Number(value.salesAmount || 0)),
    receivedIncome: round(Number(value.receivedIncome || 0)),
    cashIncome: round(Number(value.cashIncome || 0)),
    transferIncome: round(Number(value.transferIncome || 0)),
    debtAmount: round(Number(value.debtAmount || 0)),
    saleCost: round(Number(value.saleCost || 0)),
    profit: round(Number(value.profit || 0)),
    remainingWeight: round(Number(value.remainingWeight || 0)),
    remainingCost: round(Number(value.remainingCost || 0)),
  }
}

export function saveLotCycles(cycles: LotCycle[]): void {
  localStorage.setItem(KEY, JSON.stringify(cycles))
}

export function loadLotCycles(inventory: InventoryData): LotCycle[] {
  const stored = localStorage.getItem(KEY)
  let cycles: LotCycle[] = []
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) {
        cycles = parsed
          .map((item) => normalizeCycle(item))
          .filter((item): item is LotCycle => item !== null)
      }
    } catch {
      cycles = []
    }
  }

  if (!stored) {
    const legacy = createLegacyCycle(inventory)
    cycles = legacy ? [legacy] : []
    saveLotCycles(cycles)
    return cycles
  }

  const active = cycles.find((cycle) => cycle.status === 'active')
  if (active) {
    active.remainingWeight = round(inventory.stock)
    active.remainingCost = round(inventory.totalWeightCost)
    saveLotCycles(cycles)
  }
  return cycles
}

export function getActiveLotCycle(inventory: InventoryData): LotCycle | undefined {
  return loadLotCycles(inventory).find((cycle) => cycle.status === 'active')
}

function closeCycle(cycle: LotCycle, date: string, reason: LotCycle['closeReason'], inventory: InventoryData): void {
  cycle.status = 'closed'
  cycle.closedAt = date
  cycle.closeReason = reason
  cycle.remainingWeight = round(inventory.stock)
  cycle.remainingCost = round(inventory.totalWeightCost)
}

/** 每次进货开启一个新批次包；上一批结余会封存，并带入新批的期初库存。 */
export function beginNewLotCycle(inventoryBeforePurchase: InventoryData, input: PurchaseInput): LotCycle {
  const cycles = loadLotCycles(inventoryBeforePurchase)
  const active = cycles.find((cycle) => cycle.status === 'active')
  if (active) closeCycle(active, input.date, 'new_purchase', inventoryBeforePurchase)

  const sequence = cycles.reduce((highest, cycle) => Math.max(highest, cycle.sequence), 0) + 1
  const cycle: LotCycle = {
    id: `LOT-${Date.now()}`,
    sequence,
    status: 'active',
    startedAt: input.date,
    source: input.source?.trim() || '未填写',
    openingWeight: round(inventoryBeforePurchase.stock),
    openingCost: round(inventoryBeforePurchase.totalWeightCost),
    purchaseWeight: round(input.weight),
    purchaseCost: round(input.cost),
    startingWeight: round(inventoryBeforePurchase.stock + input.weight),
    startingCost: round(inventoryBeforePurchase.totalWeightCost + input.cost),
    soldWeight: 0,
    salesAmount: 0,
    receivedIncome: 0,
    cashIncome: 0,
    transferIncome: 0,
    debtAmount: 0,
    saleCost: 0,
    profit: 0,
    remainingWeight: round(inventoryBeforePurchase.stock + input.weight),
    remainingCost: round(inventoryBeforePurchase.totalWeightCost + input.cost),
  }
  cycles.push(cycle)
  saveLotCycles(cycles)
  return cycle
}

function ensureActiveLotCycle(inventory: InventoryData, date: string): { cycles: LotCycle[]; active: LotCycle } {
  const cycles = loadLotCycles(inventory)
  let active = cycles.find((cycle) => cycle.status === 'active')
  if (!active) {
    const sequence = cycles.reduce((highest, cycle) => Math.max(highest, cycle.sequence), 0) + 1
    active = {
      id: `LOT-CARRY-${Date.now()}`,
      sequence,
      status: 'active',
      startedAt: date,
      source: '结余库存',
      openingWeight: round(inventory.stock),
      openingCost: round(inventory.totalWeightCost),
      purchaseWeight: 0,
      purchaseCost: 0,
      startingWeight: round(inventory.stock),
      startingCost: round(inventory.totalWeightCost),
      soldWeight: 0,
      salesAmount: 0,
      receivedIncome: 0,
      cashIncome: 0,
      transferIncome: 0,
      debtAmount: 0,
      saleCost: 0,
      profit: 0,
      remainingWeight: round(inventory.stock),
      remainingCost: round(inventory.totalWeightCost),
    }
    cycles.push(active)
  }
  return { cycles, active }
}

export function recordLotCycleSale(inventoryBeforeSale: InventoryData, input: SaleInput): string {
  const { cycles, active } = ensureActiveLotCycle(inventoryBeforeSale, input.date)
  active.soldWeight = round(active.soldWeight + input.weight)
  active.salesAmount = round(active.salesAmount + input.amount)
  active.receivedIncome = round(active.receivedIncome + input.paidAmount)
  active.cashIncome = round(active.cashIncome + input.cashAmount)
  active.transferIncome = round(active.transferIncome + input.transferAmount)
  active.debtAmount = round(active.debtAmount + input.debtAmount)
  active.saleCost = round(active.saleCost + input.costAmount)
  active.profit = round(active.profit + input.profitAmount)
  active.remainingWeight = round(input.stockAfter)
  active.remainingCost = round(input.costAfter)
  if (input.stockAfter <= 0) {
    closeCycle(active, input.date, 'sold_out', {
      ...inventoryBeforeSale,
      stock: input.stockAfter,
      totalWeightCost: input.costAfter,
    })
  }
  saveLotCycles(cycles)
  return active.id
}

export function syncLotCycleInventory(inventory: InventoryData, date: string): void {
  const { cycles, active } = ensureActiveLotCycle(inventory, date)
  active.remainingWeight = round(inventory.stock)
  active.remainingCost = round(inventory.totalWeightCost)
  if (inventory.stock <= 0) closeCycle(active, date, 'stock_adjustment', inventory)
  saveLotCycles(cycles)
}

export function reverseLotCycleSale(
  lotCycleId: string | undefined,
  inventoryAfterRestore: InventoryData,
  input: Omit<SaleInput, 'date' | 'stockAfter' | 'costAfter'>,
): void {
  const cycles = loadLotCycles(inventoryAfterRestore)
  const cycle = lotCycleId
    ? cycles.find((item) => item.id === lotCycleId)
    : [...cycles].reverse().find((item) => item.status === 'active')
  if (!cycle) return

  cycle.soldWeight = Math.max(0, round(cycle.soldWeight - input.weight))
  cycle.salesAmount = Math.max(0, round(cycle.salesAmount - input.amount))
  cycle.receivedIncome = Math.max(0, round(cycle.receivedIncome - input.paidAmount))
  cycle.cashIncome = Math.max(0, round(cycle.cashIncome - input.cashAmount))
  cycle.transferIncome = Math.max(0, round(cycle.transferIncome - input.transferAmount))
  cycle.debtAmount = Math.max(0, round(cycle.debtAmount - input.debtAmount))
  cycle.saleCost = Math.max(0, round(cycle.saleCost - input.costAmount))
  cycle.profit = round(cycle.profit - input.profitAmount)
  const latestSequence = cycles.reduce((highest, item) => Math.max(highest, item.sequence), 0)
  if (cycle.sequence === latestSequence && inventoryAfterRestore.stock > 0) {
    cycle.remainingWeight = round(inventoryAfterRestore.stock)
    cycle.remainingCost = round(inventoryAfterRestore.totalWeightCost)
    cycle.status = 'active'
    cycle.closedAt = undefined
    cycle.closeReason = undefined
  } else if (cycle.status === 'closed') {
    // 删除历史批次中的旧出货时，只修正该封包自己的结余快照，不能拿当前总库存覆盖旧包。
    cycle.remainingWeight = round(cycle.remainingWeight + input.weight)
    cycle.remainingCost = round(cycle.remainingCost + input.costAmount)
  } else {
    cycle.remainingWeight = round(inventoryAfterRestore.stock)
    cycle.remainingCost = round(inventoryAfterRestore.totalWeightCost)
  }
  saveLotCycles(cycles)
}
