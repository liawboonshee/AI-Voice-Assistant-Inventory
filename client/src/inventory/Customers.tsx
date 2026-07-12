import { useEffect, useState } from 'react'
import { loadRecords, saveRecord } from './Records'


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


  return JSON.parse(data).map((item:any)=>({

    name:item.name || '',

    debt:item.debt || 0

  }))

}



function saveCustomers(data:CustomerData[]){

  localStorage.setItem(

    KEY,

    JSON.stringify(data)

  )

}




export default function Customers(){


const [customers,setCustomers]=useState<CustomerData[]>(loadCustomers())

const [records,setRecords]=useState(loadRecords())

const [pay,setPay]=useState<{[key:number]:string}>({})



useEffect(()=>{


const timer=setInterval(()=>{


setCustomers(loadCustomers())

setRecords(loadRecords())


},500)



return()=>clearInterval(timer)


},[])





function repay(index:number){


const amount=Number(pay[index])


if(!amount){

return

}



const list=[...customers]


const customer=list[index]


if(!customer){

return

}



customer.debt -= amount



if(customer.debt < 0){

customer.debt = 0

}



saveCustomers(list)


setCustomers(list)



saveRecord({

type:'sale',

date:new Date().toLocaleString(),

customer:customer.name,

weight:0,

amount:-amount

})



setPay({

...pay,

[index]:''

})



}





return(


<div style={{padding:24}}>


<h1>👤 客户管理</h1>



{

customers.length===0 &&

<p>

暂无客户

</p>

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

{(item.debt || 0).toFixed(2)}

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

{(r.weight || 0).toFixed(2)}g

-

{(r.amount || 0).toFixed(2)}

</p>


))

}




{

item.debt > 0 &&


<>


<input


value={pay[index] || ''}


onChange={(e)=>

setPay({

...pay,

[index]:e.target.value

})

}


placeholder="输入还款金额"


type="number"


/>




<button

onClick={()=>repay(index)}

>


确认还款


</button>



</>


}




</div>


))


}



</div>


)


}
