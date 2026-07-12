import { useState } from 'react'


type CustomerData = {
  name:string
  debt:number
}


const KEY='customers'


function loadCustomers():CustomerData[]{

  const data=localStorage.getItem(KEY)

  if(!data){

    return []

  }

  return JSON.parse(data)

}



function saveCustomers(data:CustomerData[]){

  localStorage.setItem(
    KEY,
    JSON.stringify(data)
  )

}



export default function Customers(){


  const [name,setName]=useState('')
  const [debt,setDebt]=useState('')
  const [list,setList]=useState<CustomerData[]>(loadCustomers())



  function addCustomer(){


    if(!name){

      return

    }


    const newList=[

      ...list,

      {

        name:name,

        debt:Number(debt)||0

      }

    ]


    saveCustomers(newList)

    setList(newList)

    setName('')

    setDebt('')


  }



  return(

    <div style={{padding:24}}>


      <h1>👤 客户</h1>


      <p>客户名字</p>

      <input

        value={name}

        onChange={(e)=>setName(e.target.value)}

        placeholder="客户名字"

      />


      <p>欠款</p>

      <input

        value={debt}

        onChange={(e)=>setDebt(e.target.value)}

        placeholder="金额"

        type="number"

      />


      <br/>
      <br/>


      <button onClick={addCustomer}>

        保存客户

      </button>



      <h2>客户列表</h2>



      {

        list.map((item,index)=>(


          <div key={index}>


            {item.name}

            ：欠款

            {(item.debt||0).toFixed(2)}


          </div>


        ))

      }



    </div>

  )


}
