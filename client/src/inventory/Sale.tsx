import { useState } from 'react'
import { loadInventory, saveInventory } from './Storage'
import { currentRecordDate, saveRecord } from './Records'
import { calculatePaymentBreakdown, paymentSummary } from './Payments'

type CustomerData = { name: string; phone?: string; debt: number }

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function saveCustomerSale(name: string, debtAmount: number): void {
  const customers: CustomerData[] = JSON.parse(localStorage.getItem('customers') || '[]')
  const customer = customers.find((item) => item.name === name)
  if (customer) customer.debt = round((customer.debt || 0) + debtAmount)
  else customers.push({ name, debt: round(debtAmount) })
  localStorage.setItem('customers', JSON.stringify(customers))
}

export default function Sale() {
  const [customer, setCustomer] = useState('')
  const [weight, setWeight] = useState('')
  const [price, setPrice] = useState('')
  const [cash, setCash] = useState('')
  const [transfer, setTransfer] = useState('')
  const [debt, setDebt] = useState('')
  const [message, setMessage] = useState('')

  const addSale = () => {
    const w = round(Number(weight))
    if (!Number.isFinite(w) || w < 0.01) {
      setMessage('请输入至少0.01g的重量；售价可以留空')
      return
    }

    const payment = calculatePaymentBreakdown({
      total: price.trim() === '' ? undefined : Number(price),
      cashAmount: cash.trim() === '' ? undefined : Number(cash),
      transferAmount: transfer.trim() === '' ? undefined : Number(transfer),
      debtAmount: debt.trim() === '' ? undefined : Number(debt),
    })
    if (typeof payment === 'string') {
      setMessage(payment)
      return
    }

    const data = loadInventory()
    if (data.stock < w) {
      setMessage(`库存不足，目前只有${data.stock.toFixed(2)}g`)
      return
    }

    const oldStock = data.stock
    const costPerGram = oldStock > 0 ? data.totalWeightCost / oldStock : 0
    const saleCost = round(costPerGram * w)
    const hasAmount = payment.total > 0
    const profitAmount = hasAmount ? round(payment.total - saleCost) : 0
    const customerName = customer.trim() || '未填写'
    if (payment.debtAmount > 0 && !customer.trim()) {
      setMessage('有欠款时必须填写顾客名字')
      return
    }

    data.stock = round(data.stock - w)
    data.totalWeightCost = Math.max(0, round(data.totalWeightCost - saleCost))
    data.income = round(data.income + payment.paidAmount)
    data.profit = round(data.profit + profitAmount)
    saveInventory(data)

    saveCustomerSale(customerName, payment.debtAmount)
    saveRecord({
      type: 'sale',
      date: currentRecordDate(),
      customer: customerName,
      weight: w,
      amount: payment.total,
      cashAmount: payment.cashAmount,
      transferAmount: payment.transferAmount,
      debtAmount: payment.debtAmount,
      paidAmount: payment.paidAmount,
      costAmount: saleCost,
      profitAmount,
      paymentMethod: payment.paymentMethod,
      stockAfter: data.stock,
    })

    setCustomer('')
    setWeight('')
    setPrice('')
    setCash('')
    setTransfer('')
    setDebt('')
    setMessage(
      hasAmount
        ? `✅ 出货成功：${paymentSummary(payment)}；单笔利润RM${profitAmount.toFixed(2)}`
        : '✅ 出货成功，未填写金额，已扣除库存',
    )
  }

  return (
    <div>
      <h1>📤 出货</h1>
      <p>客户</p>
      <input value={customer} onChange={(event) => setCustomer(event.target.value)} placeholder="客户名字" />
      <p>重量（g，最小0.01）</p>
      <input value={weight} onChange={(event) => setWeight(event.target.value)} placeholder="例如 10" type="number" step="0.01" />
      <p>总售价（RM，可不填）</p>
      <input value={price} onChange={(event) => setPrice(event.target.value)} placeholder="可留空；例如 800" type="number" step="0.01" />
      <p>收款分配（都可不填）</p>
      <div className="inventory-payment-split">
        <label>
          <span>💵 现金</span>
          <input value={cash} onChange={(event) => setCash(event.target.value)} placeholder="例如 300" type="number" step="0.01" />
        </label>
        <label>
          <span>🏦 转账</span>
          <input value={transfer} onChange={(event) => setTransfer(event.target.value)} placeholder="例如 400" type="number" step="0.01" />
        </label>
        <label>
          <span>🧾 欠款</span>
          <input value={debt} onChange={(event) => setDebt(event.target.value)} placeholder="可自动计算" type="number" step="0.01" />
        </label>
      </div>
      <small>例如总售价800、现金300、转账400，系统会自动记顾客欠款100。</small>
      <button type="button" onClick={addSale}>保存出货</button>
      {message && <p>{message}</p>}
    </div>
  )
}
