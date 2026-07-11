import { useState } from 'react'
import { loadInventory, saveInventory } from './Storage'

export default function Purchase() {
  const [weight, setWeight] = useState('')
  const [cost, setCost] = useState('')
  const [message, setMessage] = useState('')

  const addPurchase = () => {
    const w = Number(weight)
    const c = Number(cost)

    if (!w || !c) {
      setMessage('请输入重量和成本')
      return
    }

    const data = loadInventory()

    data.stock += w
    data.cost += c

    saveInventory(data)

    setWeight('')
    setCost('')
    setMessage('进货成功')

  }

  return (
    <div style={{padding:24}}>
      <h1>📥 进货</h1>

      <p>
        重量(g)
      </p>

      <input
        value={weight}
        onChange={(e)=>setWeight(e.target.value)}
        placeholder="例如 10.50"
      />

      <p>
        成本
      </p>

      <input
        value={cost}
        onChange={(e)=>setCost(e.target.value)}
        placeholder="例如 500"
      />

      <br/><br/>

      <button onClick={addPurchase}>
        保存进货
      </button>

      <p>{message}</p>

    </div>
  )
}
