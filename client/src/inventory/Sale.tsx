import { useState } from 'react'
import { loadInventory, saveInventory } from './Storage'
import { saveRecord } from './Records'

type CustomerData = { name: string; phone?: string; debt: number }
type PaymentMethod = 'cash' | 'transfer' | 'debt'

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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [message, setMessage] = useState('')

  const addSale = () => {
    const w = round(Number(weight))
    const hasAmount = price.trim() !== ''
    const total = hasAmount ? round(Number(price)) : 0
    if (!Number.isFinite(w) || w < 0.01 || !Number.isFinite(total) || total < 0) {
      setMessage('请输入至少0.01g的重量；售价可以留空')
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
    const debtAmount = hasAmount && paymentMethod === 'debt' ? total : 0
    const paidAmount = hasAmount && paymentMethod !== 'debt' ? total : 0
    const profitAmount = hasAmount ? round(total - saleCost) : 0
    const customerName = customer.trim() || '未填写'

    data.stock = round(data.stock - w)
    data.totalWeightCost = Math.max(0, round(data.totalWeightCost - saleCost))
    data.income = round(data.income + paidAmount)
    data.profit = round(data.profit + profitAmount)
    saveInventory(data)

    saveCustomerSale(customerName, debtAmount)
    saveRecord({
      type: 'sale',
      date: new Date().toLocaleString(),
      customer: customerName,
      weight: w,
      amount: total,
      debtAmount,
      paidAmount,
      costAmount: saleCost,
      profitAmount,
      paymentMethod: hasAmount ? paymentMethod : 'none',
    })

    setCustomer('')
    setWeight('')
    setPrice('')
    setPaymentMethod('cash')
    setMessage(
      hasAmount
        ? `✅ 出货成功，${paymentMethod === 'cash' ? '现金' : paymentMethod === 'transfer' ? '转账' : '欠款'}，单笔利润RM${profitAmount.toFixed(2)}${debtAmount > 0 ? `，欠款RM${debtAmount.toFixed(2)}` : ''}`
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
      <p>收款方式</p>
      <div className="inventory-payment-methods">
        {([
          ['cash', '💵 现金'],
          ['transfer', '🏦 转账'],
          ['debt', '🧾 欠款'],
        ] as const).map(([value, label]) => (
          <button
            className={paymentMethod === value ? 'active' : ''}
            key={value}
            onClick={() => setPaymentMethod(value)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      <button type="button" onClick={addSale}>保存出货</button>
      {message && <p>{message}</p>}
    </div>
  )
}
