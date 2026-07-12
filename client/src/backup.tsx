import { useState } from 'react'


export default function Backup(){


const [message,setMessage]=useState('')



function exportData(){


const backup={


inventory:
localStorage.getItem('inventory_data'),


records:
localStorage.getItem('inventory_records'),


customers:
localStorage.getItem('customers')


}



const text=JSON.stringify(
backup,
null,
2
)



const blob=new Blob(
[text],
{
type:'application/json'
}
)



const url=
URL.createObjectURL(blob)



const a=document.createElement('a')

a.href=url

a.download='库存宝备份.json'

a.click()


setMessage('✅ 备份成功')


}




function importData(e:any){


const file=e.target.files[0]


if(!file){

return

}



const reader=new FileReader()



reader.onload=()=>{


const data=JSON.parse(
reader.result as string
)



if(data.inventory){

localStorage.setItem(
'inventory_data',
data.inventory
)

}



if(data.records){

localStorage.setItem(
'inventory_records',
data.records
)

}



if(data.customers){

localStorage.setItem(
'customers',
data.customers
)

}



setMessage('✅ 恢复成功，请重新打开页面')


}



reader.readAsText(file)



}





return(

<div style={{padding:24}}>


<h1>💾 数据备份</h1>



<button

onClick={exportData}

style={{

fontSize:18,

padding:10

}}

>

导出备份

</button>



<br/>
<br/>



<input

type="file"

accept=".json"

onChange={importData}

/>



<p>

{message}

</p>


</div>

)


}
