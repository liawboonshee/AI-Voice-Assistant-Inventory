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

  return JSON.parse(data)

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

const [name,setName]=useState('')

const [pay,setPay]=useState<{[key:number]:string}>({})



useEffect(()=>{

const timer=setInterval(()=>{

setCustomers(loadCustomers())

setRecords(loadRecords())

},500)


return()=>clearInterval(timer)


},[])




function addCustomer(){

const newName=name.trim()


if(!newName){

return

}


const list=[...customers]


list.push({

name:newName,

debt:0

})


saveCustomers(list)

setCustomers(list)

setName('')


}





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



customer.debt-=amount


if(customer.debt<0){

customer.debt=0

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



<div>

<input

value={name}

onChange={(e)=>setName(e.target.value)}

placeholder="输入客户名字"

/>


<button onClick={addCustomer}>

➕ 添加客户

</button>


</div>




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

marginTop:15,

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

item.debt>0 &&

<div>


<input

type="number"

placeholder="还款金额"

value={pay[index]||''}

onChange={(e)=>

setPay({

...pay,

[index]:e.target.value

})

}


/>



<button onClick={()=>repay(index)}>

确认还款

</button>


</div>


}



</div>


))


}




</div>


)


}
