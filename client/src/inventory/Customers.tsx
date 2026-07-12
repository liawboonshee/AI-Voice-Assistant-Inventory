import { useEffect, useState } from 'react'
import { loadRecords } from './Records'


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


  const [customers,setCustomers]=useState(loadCustomers())

  const [records,setRecords]=useState(loadRecords())



  useEffect(()=>{


    const timer=setInterval(()=>{


      setCustomers(loadCustomers())

      setRecords(loadRecords())


    },500)



    return()=>clearInterval(timer)


  },[])





  function repay(index:number){


    const list=[...customers]


    list[index].debt=0


    saveCustomers(list)


    setCustomers(list)


  }





  return(

    <div style={{padding:24}}>


      <h1>👤 客户管理</h1>




      {
        customers.length===0 && (

          <p>
            暂无客户
          </p>

        )
      }





      {

      customers.map((item,index)=>(


        <div

        key={index}

        style={{

          border:'1px solid #555',

          padding:15,

          marginBottom:10,

          borderRadius:8

        }}

        >


          <h3>

            👤 {item.name}

          </h3>



          <p>

            欠款：

            {item.debt.toFixed(2)}

          </p>



          <h4>

            购买记录

          </h4>




          {

          records

          .filter(r=>

            r.type==='sale'
            &&
            r.customer===item.name

          )

          .map((r,i)=>(


            <p key={i}>

              {r.weight.toFixed(2)}g

              -

              {r.amount.toFixed(2)}

            </p>


          ))

          }





          {

          item.debt>0 && (

            <button

            onClick={()=>repay(index)}

            >

              已还款

            </button>

          )

          }



        </div>


      ))

      }



    </div>

  )

}
