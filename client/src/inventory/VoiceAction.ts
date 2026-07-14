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
  if (command.paymentMethod === 'debt') return command.amount ?? 0
  if (command.isDebt) return command.amount ?? 0
  return 0
}

export function getMissingCommandField(command: VoiceCommand): MissingField {
  if (command.type === 'income') return command.amount === undefined ? 'amount' : null
  if (command.type !== 'sale' && command.type !== 'purchase') return null
  if (command.weight === undefined) return 'weight'
  if (command.type === 'purchase' && command.amount === undefined) return 'amount'
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
    if (command.type === 'income') return '要记录收入多少钱？'
    const weight = command.weight?.toFixed(2)
    return command.type === 'purchase'
      ? `${weight}克已听到，总成本多少钱？`
      : `${weight}克已听到，总售价多少钱？`
  }

  return '这笔有欠款，请告诉我客户名字。'
}

export function executeParsedVoiceCommand(command: VoiceCommand): string | null {
  if (command.type !== 'sale' && command.type !== 'purchase' && command.type !== 'income') return null

  const missingPrompt = getMissingCommandPrompt(command)
  if (missingPrompt) return missingPrompt

  const amount = roundMoney(command.amount ?? 0)

  if (command.type === 'income') {
    if (!Number.isFinite(amount) || amount <= 0) return '收入金额必须大于0。'
    const data = loadInventory()
    data.income = roundMoney(data.income + amount)
    data.profit = roundMoney(data.profit + amount)
    saveInventory(data)
    saveRecord({
      type: 'income',
      date: new Date().toLocaleString(),
      weight: 0,
      amount,
      paidAmount: amount,
      costAmount: 0,
      profitAmount: amount,
      note: '其他收入',
    })
    return `✅ 已记录收入${amount.toFixed(2)}，并计入利润。`
  }

  const weight = roundMoney(command.weight ?? 0)

  if (!Number.isFinite(weight) || weight < 0.01) {
    return '重量最少是0.01克，请重新说。'
  }
  if (!Number.isFinite(amount) || amount < 0) return '金额不能小于0。'
  if (command.type === 'purchase' && amount <= 0) return '总成本必须大于0。'

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
      profitAmount: 0,
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
  const hasAmount = command.amount !== undefined && amount > 0
  const profitAmount = hasAmount ? roundMoney(amount - saleCost) : 0

  data.stock = roundMoney(data.stock - weight)
  data.totalWeightCost = Math.max(0, roundMoney(data.totalWeightCost - saleCost))
  data.income = roundMoney(data.income + paidAmount)
  data.profit = roundMoney(data.profit + profitAmount)

  const customer = command.customer || '未填写'
  addCustomerDebt(customer, debtAmount)

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
    profitAmount,
    paymentMethod: hasAmount
      ? debtAmount > 0
        ? 'debt'
        : command.paymentMethod || 'cash'
      : 'none',
  })

  const debtText = debtAmount > 0 ? `，欠款${debtAmount.toFixed(2)}` : ''
  return hasAmount
    ? `✅ 已记录出货：${customer}，${weight.toFixed(2)}克，售价${amount.toFixed(2)}${debtText}；库存${data.stock.toFixed(2)}克。`
    : `✅ 已记录出货：${customer}，${weight.toFixed(2)}克，未填写金额；库存${data.stock.toFixed(2)}克。`
}

export function executeVoiceCommand(text: string): string | null {
  return executeParsedVoiceCommand(parseVoiceCommand(text))
}
