import { loadInventory } from './Storage'
import { loadRecords, type RecordItem } from './Records'
import { parseVoiceCommand } from './VoiceCommand'
import { recordCashIn, recordProfit } from './Analytics'

type CustomerData = {
  name: string
  debt: number
}

function loadCustomers(): CustomerData[] {
  try {
    const data = JSON.parse(localStorage.getItem('customers') || '[]')
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function sameLocalDay(dateText: string, target: Date): boolean {
  const date = new Date(dateText)
  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === target.getFullYear() &&
    date.getMonth() === target.getMonth() &&
    date.getDate() === target.getDate()
  )
}

function sum(records: RecordItem[], field: 'weight' | 'amount'): number {
  return records.reduce((total, record) => total + (record[field] || 0), 0)
}

function describeLastRecord(record: RecordItem | undefined): string {
  if (!record) return '目前还没有交易记录。'

  if (record.type === 'purchase') {
    return `最近一笔是进货：${record.weight.toFixed(2)}克，成本${record.amount.toFixed(2)}，时间${record.date}。`
  }

  if (record.type === 'income') {
    return `最近一笔是${record.note || '收入'}：${record.amount.toFixed(2)}，时间${record.date}。`
  }

  const debtText = (record.debtAmount || 0) > 0 ? `，欠款${record.debtAmount?.toFixed(2)}` : ''
  return `最近一笔是出货：${record.customer || '未填写'}，${record.weight.toFixed(2)}克，售价${record.amount.toFixed(2)}${debtText}，时间${record.date}。`
}

export function askInventory(input: string): string | null {
  const command = parseVoiceCommand(input)
  if (command.type !== 'query' || !command.query) return null

  const text = input.toLowerCase()
  const data = loadInventory()
  const allRecords = loadRecords()
  const records = text.includes('今天')
    ? allRecords.filter((record) => sameLocalDay(record.date, new Date()))
    : allRecords
  const period = text.includes('今天') ? '今天' : '目前'

  if (command.query === 'last') {
    return describeLastRecord(allRecords[allRecords.length - 1])
  }

  if (command.query === 'stock') {
    const avgCost = data.stock > 0 ? data.totalWeightCost / data.stock : 0
    return `目前库存${data.stock.toFixed(2)}克，库存本金${data.totalWeightCost.toFixed(2)}，平均成本${avgCost.toFixed(2)}每克。`
  }

  if (command.query === 'income') {
    if (text.includes('今天')) {
      const paid = records.reduce((total, record) => total + recordCashIn(record), 0)
      return `今天实收${paid.toFixed(2)}。`
    }
    return `目前累计实收${data.income.toFixed(2)}。`
  }

  if (command.query === 'profit') {
    if (text.includes('今天')) {
      const profit = records.reduce((total, record) => total + recordProfit(record), 0)
      return `今天利润${profit.toFixed(2)}。`
    }
    return `目前累计利润${data.profit.toFixed(2)}。`
  }

  if (command.query === 'sales') {
    const sales = records.filter((record) => record.type === 'sale' && record.weight > 0)
    return `${period}出货${sum(sales, 'weight').toFixed(2)}克，销售额${sum(sales, 'amount').toFixed(2)}，共${sales.length}笔。`
  }

  if (command.query === 'purchases') {
    const purchases = records.filter((record) => record.type === 'purchase')
    return `${period}进货${sum(purchases, 'weight').toFixed(2)}克，总成本${sum(purchases, 'amount').toFixed(2)}，共${purchases.length}笔。`
  }

  if (command.query === 'records') {
    return `${period}共有${records.length}笔交易记录。`
  }

  if (command.query === 'debt') {
    const customers = loadCustomers()
    if (command.customer) {
      const customer = customers.find((item) => item.name === command.customer)
      return customer
        ? `${customer.name}目前欠款${(customer.debt || 0).toFixed(2)}。`
        : `没有找到客户“${command.customer}”的欠款记录。`
    }

    const totalDebt = customers.reduce((total, customer) => total + (customer.debt || 0), 0)
    const debtors = customers.filter((customer) => (customer.debt || 0) > 0).length
    return `目前客户总欠款${totalDebt.toFixed(2)}，共有${debtors}位客户欠款。`
  }

  if (command.query === 'cost') {
    const avgCost = data.stock > 0 ? data.totalWeightCost / data.stock : 0
    return `目前库存本金${data.totalWeightCost.toFixed(2)}，平均成本${avgCost.toFixed(2)}每克，累计进货成本${data.cost.toFixed(2)}。`
  }

  const customers = loadCustomers()
  const debt = customers.reduce((total, customer) => total + (customer.debt || 0), 0)
  return `库存${data.stock.toFixed(2)}克，实收${data.income.toFixed(2)}，利润${data.profit.toFixed(2)}，客户欠款${debt.toFixed(2)}，共${allRecords.length}笔交易。`
}
