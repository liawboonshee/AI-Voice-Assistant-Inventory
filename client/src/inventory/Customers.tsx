import { useState } from 'react'

type CustomerData = {
  name: string
  debt: number
}

const KEY = 'customers'

function loadCustomers(): CustomerData[] {
  const data = localStorage.getItem(KEY)

  if (!data) {
    return []
  }

  return JSON.parse(data)
}

function saveCustomers(data: CustomerData[]) {
  localStorage.setItem(
    KEY,
    JSON.stringify(data)
  )
}


export default function Customer() {

  const [name, setName] = useState('')
  const [debt, setDebt] = useState('')
  const [list, setList] = useState(loadCustomers())


  const addCustomer = () => {

    if (!name) return

    const newData = [
      ...list,
      {
        name,
        debt: Number(debt) || 0
      }
    ]

    saveCustomers(newData)

    setList(newData)

    setName('')
    setDebt('')
  }


  return (
    <div style={{padding:24}}>

      <h1>👤 客户</h1>

      <p>客户名字</p>

      <input
        value={name}
        onChange={(e)=>setName(e.target.value)}
        placeholder="输入客户"
      />

      <p>欠款</p>

      <input
        value={debt}
        onChange={(e)=>setDebt(e.target.value)}
        placeholder="金额"
      />

      <br/><br/>

      <button onClick={addCustomer}>
        保存客户
      </button>


      <h3>客户列表</h3>

      {
        list.map((item,index)=>(
          <div key={index}>
            {item.name}
            ：欠款 {item.debt}
          </div>
        ))
      }

    </div>
  )
}
