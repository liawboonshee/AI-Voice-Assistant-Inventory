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
  const [search, setSearch] = useState('')
  const [pay, setPay] = useState<Record<number, string>>({})
  const [newDebt, setNewDebt] = useState<Record<number, string>>({})
  const [historyLimits, setHistoryLimits] = useState<Record<string, number>>({})
  const [message, setMessage] = useState('')

  const searchQuery = search.trim().toLowerCase().replace(/\s+/g, '')
  const visibleCustomers = customers
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => {
      if (!searchQuery) return true
      const customerName = item.name.toLowerCase().replace(/\s+/g, '')
      const customerPhone = (item.phone || '').toLowerCase().replace(/\s+/g, '')
      return customerName.includes(searchQuery) || customerPhone.includes(searchQuery)
    })

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
    inventory.profit = round(inventory.profit + actualPayment)
    saveInventory(inventory)
    saveRecord({
      type: 'income',
      date: currentRecordDate(),
      customer: customer.name,
      weight: 0,
      amount: actualPayment,
      paidAmount: actualPayment,
      costAmount: 0,
      profitAmount: actualPayment,
      note: '客户还款',
    })
    setRecords(loadRecords())
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
      <input
        aria-label="搜索顾客"
        className="customer-search-input"
        inputMode="search"
        placeholder="🔎 搜索顾客名字或电话号码"
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {customers.length === 0 && <p>暂无客户</p>}
      {customers.length > 0 && visibleCustomers.length === 0 && <p>找不到符合“{search.trim()}”的顾客</p>}

      {visibleCustomers.map(({ item, index }) => {
        const purchaseHistory = records.filter(
          (record) => record.type === 'sale' && record.customer === item.name && record.weight > 0,
        )
        const repaymentHistory = records.filter(
          (record) => record.type === 'income' && record.note === '客户还款' && record.customer === item.name,
        )
        const history = records.filter(
          (record) => record.customer === item.name && (
            (record.type === 'sale' && record.weight > 0) ||
            (record.type === 'income' && record.note === '客户还款')
          ),
        )
        const newestHistory = history.slice().reverse()
        const historyLimit = historyLimits[item.name] || 8
        const visibleHistory = newestHistory.slice(0, historyLimit)
        const totalWeight = purchaseHistory.reduce((sum, record) => sum + record.weight, 0)
        const totalSpend = purchaseHistory.reduce((sum, record) => sum + record.amount, 0)
        const salePaid = purchaseHistory.reduce(
          (sum, record) => sum + (record.paidAmount ?? Math.max(0, record.amount - (record.debtAmount || 0))),
          0,
        )
        const repaymentPaid = repaymentHistory.reduce((sum, record) => sum + record.amount, 0)
        const totalPaid = salePaid + repaymentPaid
        return (
          <details className="customer-card customer-card-collapsible" key={item.name}>
            <summary className="customer-list-summary">
              <span className="customer-list-identity">
                <strong>👤 {item.name}</strong>
                <small>{item.phone || '未填电话'}</small>
              </span>
              <span className={`customer-list-debt${item.debt > 0 ? ' has-debt' : ''}`}>
                欠款 RM{item.debt.toFixed(2)}
              </span>
            </summary>
            <div className="customer-card-expanded">
              <div className="customer-summary-grid">
                <span><small>购买</small>{totalWeight.toFixed(2)}g</span>
                <span><small>消费</small>RM{totalSpend.toFixed(2)}</span>
                <span><small>已付</small>RM{totalPaid.toFixed(2)}</span>
                <strong><small>欠款</small>RM{item.debt.toFixed(2)}</strong>
              </div>
              <details className="customer-card-details">
                <summary>欠款操作</summary>
                <div className="customer-debt-add-row">
                  <input type="number" min="0" step="0.01" placeholder="新增欠款金额" value={newDebt[index] || ''} onChange={(event) => setNewDebt({ ...newDebt, [index]: event.target.value })} />
                  <button type="button" onClick={() => addDebt(index)}>新增</button>
                </div>
                {item.debt > 0 && (
                  <div className="customer-repay-row">
                    <input type="number" placeholder="还款金额" value={pay[index] || ''} onChange={(event) => setPay({ ...pay, [index]: event.target.value })} />
                    <button type="button" onClick={() => repay(index)}>还款</button>
                  </div>
                )}
              </details>
              <div className="customer-history-panel">
                <h4>购买 / 还款记录（{history.length}）</h4>
                {history.length === 0 ? (
                  <p>暂无购买或还款记录</p>
                ) : (
                  <>
                    {visibleHistory.map((record, recordIndex) => {
                      const isRepayment = record.type === 'income' && record.note === '客户还款'
                      const debtAmount = Math.max(0, record.debtAmount || 0)
                      return (
                        <p
                          className={`customer-history-row${
                            isRepayment
                              ? ' customer-history-repayment'
                              : debtAmount > 0
                                ? ' customer-history-debt'
                                : ''
                          }`}
                          key={`${record.date}-${recordIndex}`}
                        >
                          <span>{formatRecordDate(record.date)}</span>
                          <strong className="customer-history-value">
                            <span className="customer-history-main">
                              {isRepayment
                                ? `💳 还款 RM${record.amount.toFixed(2)}`
                                : `${record.weight.toFixed(2)}g · RM${record.amount.toFixed(2)}`}
                            </span>
                            {!isRepayment && (
                              <small className="customer-history-status">
                                {debtAmount > 0 ? `欠款 RM${debtAmount.toFixed(2)}` : '已付清'}
                              </small>
                            )}
                          </strong>
                        </p>
                      )
                    })}
                    {historyLimit < newestHistory.length && (
                      <button
                        className="customer-history-more-button"
                        type="button"
                        onClick={() => setHistoryLimits((limits) => ({
                          ...limits,
                          [item.name]: Math.min((limits[item.name] || 8) + 8, newestHistory.length),
                        }))}
                      >
                        查看更早记录（剩余{newestHistory.length - historyLimit}笔）
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </details>
        )
      })}
    </div>
  )
}
