import { useState } from 'react'
import { loadInventory, saveInventory } from './Storage'
import { saveRecord } from './Records'


export default function Sale(){


  const [customer,setCustomer] = useState('')

  const [weight,setWeight] = useState('')

  const [price,setPrice] = useState('')

  const [debt,setDebt] = useState(false)

  const [message,setMessage] = useState('')



  const addCustomerDebt = (
    name:string,
    amount:number
  )=>{


    const data = JSON.parse(
      localStorage.getItem('customers') || '[]'
    )


    const index = data.findIndex(
      (item:any)=>item.name===name
    )


    if(index>=0){

      data[index].debt += amount

    }else{

      data.push({

        name:name,

        debt:amount

      })

    }


    localStorage.setItem(
      'customers',
      JSON.stringify(data)
    )


  }




  const addSale = ()=>{


    const w = Number(weight)

    const p = Number(price)



    if(!w || !p){

      setMessage('请输入重量和售价')

      return

    }



    const data = loadInventory()



    if(data.stock < w){

      setMessage('库存不足')

      return

    }



    const total = w * p



    // 保存记录

    saveRecord({

      type:'sale',

      date:new Date().toLocaleString(),

      customer:customer || '未填写',

      weight:w,

      amount:total

    })





    // 扣库存

    data.stock -= w





    // 已付款才算收入

    if(!debt){

      data.income += total

      data.profit += total

    }
    else{

      addCustomerDebt(
        customer || '未填写',
        total
      )

    }





    saveInventory(data)



    setCustomer('')

    setWeight('')

    setPrice('')

    setDebt(false)

    setMessage(
      debt ? '✅ 出货成功（欠款）' : '✅ 出货成功'
    )


  }




  return (

    <div style={{padding:24}}>


      <h1>📤 出货</h1>



      <p>客户</p>

      <input

        value={customer}

        onChange={
          e=>setCustomer(e.target.value)
        }

        placeholder="客户名字"

        style={{
          width:'100%',
          fontSize:18
        }}

      />



      <p>重量(g)</p>

      <input

        value={weight}

        onChange={
          e=>setWeight(e.target.value)
        }

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

        onChange={
          e=>setPrice(e.target.value)
        }

        placeholder="例如 600"

        type="number"

        step="0.01"

        style={{
          width:'100%',
          fontSize:18
        }}

      />



      <br/>

      <label>

        <input

          type="checkbox"

          checked={debt}

          onChange={
            e=>setDebt(e.target.checked)
          }

        />

        欠款

      </label>



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
