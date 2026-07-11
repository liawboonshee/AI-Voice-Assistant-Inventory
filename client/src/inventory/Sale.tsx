import { useState } from 'react'
import { loadInventory, saveInventory } from './Storage'

export default function Sale() {

  const [weight, setWeight] = useState('')
  const [price, setPrice] = useState('')
  const [customer, setCustomer] = useState('')
  const [message, setMessage] = useState('')

  const addSale = () => {

    const w = Number(weight)
    const p = Number(price)

    if (!w || !p) {
      setMessage('请输入重量和售价')
      return
    }

    const data = loadInventory()

    if (data.stock < w) {
      setMessage('库存不足')
      return
    }

    const income = w * p

    data.stock -= w
    data.income += income
    data.profit += income

    saveInventory(data)

    setWeight('')
    setPrice('')
    setCustomer('')
    setMessage('出货成功')

  }


  return (
    <div style={{padding:24}}>

      <h1>📤 出货</h1>

      <p>客户</p>
      <input
        value={customer}
        onChange={(e)=>setCustomer(e.target.value)}
        placeholder="客户名字"
      />

      <p>重量(g)</p>
      <input
        value={weight}
        onChange={(e)=>setWeight(e.target.value)}
        placeholder="例如 5.00"
      />

      <p>售价/克</p>
      <input
        value={price}
        onChange={(e)=>setPrice(e.target.value)}
        placeholder="例如 300"
      />

      <br/><br/>

      <button onClick={addSale}>
        保存出货
      </button>

      <p>{message}</p>

    </div>
  )
}
