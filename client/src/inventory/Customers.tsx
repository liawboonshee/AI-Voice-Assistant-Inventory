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


const [list,setList]=useState(loadCustomers())



const addDebt=(name:string,amount:number)=>{


const old=[...list]


const index=old.findIndex(

(item)=>item.name===name

)



if(index>=0){

old[index].debt+=amount

}else{

old.push({

name,

debt:amount

})

}



saveCustomers(old)

setList(old)



}



return (

<div style={{padding:24}}>


<h1>👤 客户欠款</h1>


<p>

客户资料管理

</p>


{

list.length===0 && (

<p>暂无客户</p>

)

}



{

list.map((item,index)=>(


<div

key={index}

style={{

border:'1px solid #555',

padding:12,

margin:10

}}

>


<p>

姓名：

{item.name}

</p>


<p>

欠款：

{item.debt.toFixed(2)}

</p>


</div>


))

}


</div>

)


}
