import { loadInventory } from './Storage'
import { loadRecords } from './Records'


export function askInventory(command:string){


const text=command.toLowerCase()



const data=loadInventory()

const records=loadRecords()



if(
text.includes('库存') ||
text.includes('多少')
){

return `目前库存还有 ${data.stock.toFixed(2)} 克`

}



if(
text.includes('收入') ||
text.includes('赚')
){

return `目前总收入 ${data.income.toFixed(2)}`

}



if(
text.includes('利润') ||
text.includes('盈利')
){

return `目前利润 ${data.profit.toFixed(2)}`

}



if(
text.includes('出货')
||
text.includes('卖')
){

const total =
records

.filter(r=>r.type==='sale')

.reduce(
(sum,r)=>sum+r.weight,
0
)


return `目前总出货量 ${total.toFixed(2)} 克`

}



return null


}
