import { useState } from 'react'
import { saveRecord } from './Records'
import { loadInventory, saveInventory } from './Storage'


export default function Sale() {


  const [weight, setWeight] = useState('')
  const [price, setPrice] = useState('')
  const [customer, setCustomer] = useState('')
  const [message, setMessage] = useState('')


  const addSale = () => {


    const w = Number(weight)
    const total = Number(price)


    if (!w || !total) {

      setMessage('请输入重量和总售价')
      return

    }


    const data = loadInventory()


    if (data.stock < w) {

      setMessage('库存不足')
      return

    }



    // 扣库存

    data.stock -= w



    // 增加收入

    data.income += total



    // 暂时利润=收入
    // 后面加入成本后修改

    data.profit += total



    saveInventory(data)



    // 保存销售记录

    saveRecord({

      type:'sale',

      date:new Date().toLocaleString(),

      customer:customer || '未填写',

      weight:w,

      amount:total

    })



    setWeight('')

    setPrice('')

    setCustomer('')


    setMessage('✅ 出货成功')


  }



  return (

    <div style={{padding:24}}>


      <h1>📤 出货</h1>



      <p>客户</p>


      <input

        value={customer}

        onChange={(e)=>setCustomer(e.target.value)}

        placeholder="客户名字"

        style={{
          width:'100%',
          fontSize:18
        }}

      />



      <p>重量(g)</p>


      <input

        value={weight}

        onChange={(e)=>setWeight(e.target.value)}

        placeholder="例如 6.25"

        type="number"

        step="0.01"

        style={{
          width:'100%',
          fontSize:18
        }}

      />



      <p>总售价</p>


      <input

        value={price}

        onChange={(e)=>setPrice(e.target.value)}

        placeholder="例如 600"

        type="number"

        step="0.01"

        style={{
          width:'100%',
          fontSize:18
        }}

      />



      <br/>

      <br/>



      <button

        onClick={addSale}

        style={{

          fontSize:20,

          padding:'10px 30px'

        }}

      >

        保存出货

      </button>



      <p>{message}</p>


    </div>

  )

}
