import { useState } from 'react'
import { saveRecord } from './Records'
import { loadInventory, saveInventory } from './Storage'

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export default function Income() {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('其他收入')
  const [message, setMessage] = useState('')

  function saveIncome() {
    const value = round(Number(amount))
    if (!Number.isFinite(value) || value <= 0) {
      setMessage('请输入正确收入金额')
      return
    }
    const data = loadInventory()
    data.income = round(data.income + value)
    data.profit = round(data.profit + value)
    saveInventory(data)
    saveRecord({
      type: 'income',
      date: new Date().toLocaleString(),
      weight: 0,
      amount: value,
      paidAmount: value,
      costAmount: 0,
      profitAmount: value,
      note: note.trim() || '其他收入',
    })
    setAmount('')
    setMessage(`✅ 已记录收入RM${value.toFixed(2)}，并计入利润`)
  }

  return (
    <div>
      <h1>💰 记录收入</h1>
      <p>收入金额（RM）</p>
      <input type="number" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="例如 2500" />
      <p>备注</p>
      <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="例如：其他收入" />
      <button type="button" onClick={saveIncome}>保存收入并计算利润</button>
      {message && <p>{message}</p>}
    </div>
  )
}
