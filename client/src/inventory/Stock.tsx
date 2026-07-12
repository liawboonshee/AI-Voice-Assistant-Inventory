import { loadInventory } from './Storage'


export default function Stock(){


const data=loadInventory()



return(

<div style={{padding:24}}>


<h1>📦 库存</h1>


<p>

剩余库存：

{data.stock.toFixed(2)} g

</p>


</div>

)

}
