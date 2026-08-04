import { useState } from 'react'
import { currentRecordDate, saveRecord } from './Records'

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export default function Expense() {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('日常消费')
  const [message, setMessage] = useState('')

  function saveExpense() {
    const value = round(Number(amount))
    if (!Number.isFinite(value) || value <= 0) {
      setMessage('请输入正确消费金额')
      return
    }

    saveRecord({
      type: 'expense',
      date: currentRecordDate(),
      weight: 0,
      amount: value,
      profitAmount: 0,
      note: note.trim() || '日常消费',
    })
    setAmount('')
    setMessage(`✅ 已记录消费RM${value.toFixed(2)}，不会扣库存或计入利润`)
  }

  return (
    <div>
      <h1>💸 记录消费</h1>
      <p>消费金额（RM）</p>
      <input
        type="number"
        min="0"
        step="0.01"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        placeholder="例如 50"
      />
      <p>备注</p>
      <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="例如：交通、餐饮或杂费" />
      <button type="button" onClick={saveExpense}>保存消费</button>
      {message && <p>{message}</p>}
    </div>
  )
}
