import { useState } from 'react'
import { loadInventory, saveInventory } from './Storage'
import { saveRecord } from './Records'


export default function Sale() {

  const [weight,setWeight] = useState('')
  const [price,setPrice] = useState('')
  const [customer,setCustomer] = useState('')
  const [message,setMessage] = useState('')


  function addSale(){

    const w = Number(weight)
    const total = Number(price)


    if(!w || !total){
      setMessage('请输入重量和总金额')
      return
    }


    const data = loadInventory()


    if(data.stock < w){
      setMessage('库存不足')
      return
    }


    // 每克成本
    const costPerGram =
      data.stock > 0
      ? data.totalWeightCost / data.stock
      : 0


    const usedCost =
      costPerGram * w


    const profit =
      total - usedCost



    data.stock -= w

    data.totalWeightCost -= usedCost

    data.income += total

    data.profit += profit



    saveRecord({

      type:'sale',

      date:new Date().toLocaleString(),

      customer:customer || '未填写',

      weight:w,

      amount:total

    })


    saveInventory(data)


    setWeight('')
    setPrice('')
    setCustomer('')

    setMessage(
      `✅ 出货成功 利润:${profit.toFixed(2)}`
    )

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
        type="number"
        step="0.01"
        placeholder="例如 6.25"
      />


      <p>总金额</p>

      <input
        value={price}
        onChange={(e)=>setPrice(e.target.value)}
        type="number"
        step="0.01"
        placeholder="例如 600"
      />


      <br/>
      <br/>


      <button onClick={addSale}>
        保存出货
      </button>


      <p>{message}</p>


    </div>

  )

}
