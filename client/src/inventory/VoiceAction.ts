import { loadInventory, saveInventory } from './Storage'
import { saveRecord } from './Records'
import { parseVoiceCommand, type VoiceCommand } from './VoiceCommand'

type MissingField = 'weight' | 'amount' | 'customer' | null

type CustomerData = {
  name: string
  debt: number
}

const CUSTOMER_KEY = 'customers'

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function loadCustomers(): CustomerData[] {
  try {
    const data = JSON.parse(localStorage.getItem(CUSTOMER_KEY) || '[]')
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function addCustomerDebt(name: string, amount: number): void {
  const customers = loadCustomers()
  const customer = customers.find((item) => item.name === name)

  if (customer) {
    customer.debt = roundMoney((customer.debt || 0) + amount)
  } else {
    customers.push({ name, debt: roundMoney(amount) })
  }

  localStorage.setItem(CUSTOMER_KEY, JSON.stringify(customers))
}

function getDebtAmount(command: VoiceCommand): number {
  if (command.debtAmount !== undefined) return command.debtAmount
  if (command.isDebt) return command.amount ?? 0
  return 0
}

export function getMissingCommandField(command: VoiceCommand): MissingField {
  if (command.type !== 'sale' && command.type !== 'purchase') return null
  if (command.weight === undefined) return 'weight'
  if (command.amount === undefined) return 'amount'
  if (command.type === 'sale' && getDebtAmount(command) > 0 && !command.customer) {
    return 'customer'
  }
  return null
}

export function getMissingCommandPrompt(command: VoiceCommand): string | null {
  const missing = getMissingCommandField(command)
  if (!missing) return null

  if (missing === 'weight') {
    return command.type === 'purchase' ? '要进货多少克？' : '要出货多少克？'
  }

  if (missing === 'amount') {
    const weight = command.weight?.toFixed(2)
    return command.type === 'purchase'
      ? `${weight}克已听到，总成本多少钱？`
      : `${weight}克已听到，总售价多少钱？`
  }

  return '这笔有欠款，请告诉我客户名字。'
}

export function executeParsedVoiceCommand(command: VoiceCommand): string | null {
  if (command.type !== 'sale' && command.type !== 'purchase') return null

  const missingPrompt = getMissingCommandPrompt(command)
  if (missingPrompt) return missingPrompt

  const weight = roundMoney(command.weight ?? 0)
  const amount = roundMoney(command.amount ?? 0)

  if (!Number.isFinite(weight) || weight < 0.01) {
    return '重量最少是0.01克，请重新说。'
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return command.type === 'purchase' ? '总成本必须大于0。' : '总售价必须大于0。'
  }

  const data = loadInventory()

  if (command.type === 'purchase') {
    data.stock = roundMoney(data.stock + weight)
    data.totalWeightCost = roundMoney(data.totalWeightCost + amount)
    data.cost = roundMoney(data.cost + amount)
    saveInventory(data)

    saveRecord({
      type: 'purchase',
      date: new Date().toLocaleString(),
      weight,
      amount,
      costAmount: amount,
    })

    return `✅ 已记录进货：${weight.toFixed(2)}克，成本${amount.toFixed(2)}；库存${data.stock.toFixed(2)}克。`
  }

  if (data.stock < weight) {
    return `库存不足。目前只有${data.stock.toFixed(2)}克，不能出货${weight.toFixed(2)}克。`
  }

  const debtAmount = roundMoney(getDebtAmount(command))
  if (debtAmount < 0 || debtAmount > amount) {
    return `欠款不能超过总售价${amount.toFixed(2)}。`
  }

  const oldStock = data.stock
  const costPerGram = oldStock > 0 ? data.totalWeightCost / oldStock : 0
  const saleCost = roundMoney(costPerGram * weight)
  const paidAmount = roundMoney(amount - debtAmount)

  data.stock = roundMoney(data.stock - weight)
  data.totalWeightCost = Math.max(0, roundMoney(data.totalWeightCost - saleCost))
  data.income = roundMoney(data.income + paidAmount)
  data.profit = roundMoney(data.profit + amount - saleCost)

  const customer = command.customer || '未填写'
  if (debtAmount > 0) addCustomerDebt(customer, debtAmount)

  saveInventory(data)
  saveRecord({
    type: 'sale',
    date: new Date().toLocaleString(),
    customer,
    weight,
    amount,
    debtAmount,
    paidAmount,
    costAmount: saleCost,
  })

  const debtText = debtAmount > 0 ? `，欠款${debtAmount.toFixed(2)}` : ''
  return `✅ 已记录出货：${customer}，${weight.toFixed(2)}克，售价${amount.toFixed(2)}${debtText}；库存${data.stock.toFixed(2)}克。`
}

export function executeVoiceCommand(text: string): string | null {
  return executeParsedVoiceCommand(parseVoiceCommand(text))
}
