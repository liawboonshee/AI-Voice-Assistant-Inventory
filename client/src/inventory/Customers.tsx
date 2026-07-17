import { useEffect, useState } from 'react'
import { currentRecordDate, loadRecords, saveRecord } from './Records'
import { formatRecordDate } from './Analytics'
import { loadInventory, saveInventory } from './Storage'

type CustomerData = { name: string; phone?: string; debt: number }
const KEY = 'customers'

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function loadCustomers(): CustomerData[] {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function saveCustomers(data: CustomerData[]) {
  localStorage.setItem(KEY, JSON.stringify(data))
}

export default function Customers() {
  const [customers, setCustomers] = useState<CustomerData[]>(loadCustomers())
  const [records, setRecords] = useState(loadRecords())
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [pay, setPay] = useState<Record<number, string>>({})
  const [newDebt, setNewDebt] = useState<Record<number, string>>({})
  const [message, setMessage] = useState('')

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCustomers(loadCustomers())
      setRecords(loadRecords())
    }, 700)
    return () => window.clearInterval(timer)
  }, [])

  function addCustomer() {
    const newName = name.trim()
    if (!newName) {
      setMessage('请输入客户名字')
      return
    }
    const list = [...customers]
    const existing = list.find((item) => item.name === newName)
    if (existing) existing.phone = phone.trim() || existing.phone
    else list.push({ name: newName, phone: phone.trim() || undefined, debt: 0 })
    saveCustomers(list)
    setCustomers(list)
    setName('')
    setPhone('')
    setMessage(existing ? '✅ 客户资料已更新' : '✅ 客户已添加')
  }

  function repay(index: number) {
    const amount = round(Number(pay[index]))
    const list = [...customers]
    const customer = list[index]
    if (!customer || !Number.isFinite(amount) || amount <= 0) return
    const actualPayment = Math.min(amount, customer.debt)
    if (actualPayment <= 0) return

    customer.debt = Math.max(0, round(customer.debt - actualPayment))
    saveCustomers(list)
    setCustomers(list)

    const inventory = loadInventory()
    inventory.income = round(inventory.income + actualPayment)
    saveInventory(inventory)
    saveRecord({
      type: 'income',
      date: currentRecordDate(),
      customer: customer.name,
      weight: 0,
      amount: actualPayment,
      paidAmount: actualPayment,
      costAmount: 0,
      profitAmount: 0,
      note: '客户还款',
    })
    setPay({ ...pay, [index]: '' })
    setMessage(`✅ ${customer.name}已还款RM${actualPayment.toFixed(2)}`)
  }

  function addDebt(index: number) {
    const amount = round(Number(newDebt[index]))
    const list = [...customers]
    const customer = list[index]
    if (!customer || !Number.isFinite(amount) || amount <= 0) {
      setMessage('请输入正确的新增欠款金额')
      return
    }

    customer.debt = round((customer.debt || 0) + amount)
    saveCustomers(list)
    setCustomers(list)
    saveRecord({
      type: 'debt',
      date: currentRecordDate(),
      customer: customer.name,
      weight: 0,
      amount,
      debtAmount: amount,
      paidAmount: 0,
      costAmount: 0,
      profitAmount: 0,
      note: '手动新增欠款',
    })
    setNewDebt({ ...newDebt, [index]: '' })
    setMessage(`✅ 已为${customer.name}新增欠款RM${amount.toFixed(2)}`)
  }

  return (
    <div>
      <h1>👤 客户管理</h1>
      <div className="customer-add-grid">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="客户名字" />
        <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="电话（可选）" type="tel" />
      </div>
      <button type="button" onClick={addCustomer}>➕ 添加 / 更新客户</button>
      {message && <p>{message}</p>}
      {customers.length === 0 && <p>暂无客户</p>}

      {customers.map((item, index) => {
        const history = records.filter(
          (record) => record.type === 'sale' && record.customer === item.name && record.weight > 0,
        )
        const totalWeight = history.reduce((sum, record) => sum + record.weight, 0)
        const totalSpend = history.reduce((sum, record) => sum + record.amount, 0)
        const totalPaid = history.reduce(
          (sum, record) => sum + (record.paidAmount ?? Math.max(0, record.amount - (record.debtAmount || 0))),
          0,
        )
        return (
          <section className="customer-card" key={item.name}>
            <h3>👤 {item.name}</h3>
            <p>电话：{item.phone || '未填写'}</p>
            <div className="customer-summary-grid">
              <span>购买 {totalWeight.toFixed(2)}g</span>
              <span>消费 RM{totalSpend.toFixed(2)}</span>
              <span>已付款 RM{totalPaid.toFixed(2)}</span>
              <strong>欠款 RM{item.debt.toFixed(2)}</strong>
            </div>
            <div className="customer-debt-add-row">
              <input type="number" min="0" step="0.01" placeholder="新增欠款金额" value={newDebt[index] || ''} onChange={(event) => setNewDebt({ ...newDebt, [index]: event.target.value })} />
              <button type="button" onClick={() => addDebt(index)}>新增欠款</button>
            </div>
            <h4>历史购买记录</h4>
            {history.length === 0 ? (
              <p>暂无购买记录</p>
            ) : (
              history.slice().reverse().slice(0, 8).map((record, recordIndex) => (
                <p className="customer-history-row" key={`${record.date}-${recordIndex}`}>
                  <span>{formatRecordDate(record.date)}</span>
                  <strong>{record.weight.toFixed(2)}g · RM{record.amount.toFixed(2)}</strong>
                </p>
              ))
            )}
            {item.debt > 0 && (
              <div className="customer-repay-row">
                <input type="number" placeholder="还款金额" value={pay[index] || ''} onChange={(event) => setPay({ ...pay, [index]: event.target.value })} />
                <button type="button" onClick={() => repay(index)}>确认还款</button>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
