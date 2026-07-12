import { loadInventory, saveInventory } from './Storage'
import { saveRecord } from './Records'
import { parseVoiceCommand } from './VoiceCommand'



export function executeVoiceCommand(text:string){



const command =
parseVoiceCommand(text)



const data =
loadInventory()





// 查询库存

if(command.type==='query'){


return `目前库存 ${data.stock.toFixed(2)} 克`


}








// 出货


if(command.type==='sale'){



if(command.weight===undefined){


return '没有识别到重量'


}




if(command.amount===undefined){


return '没有识别到金额'


}






if(data.stock < command.weight){


return '库存不足'


}







data.stock -= command.weight



data.income += command.amount



data.profit += command.amount






saveInventory(data)







saveRecord({


type:'sale',


date:new Date().toLocaleString(),


customer:
command.customer || '未填写',


weight:
command.weight,


amount:
command.amount



})







return `出货成功 ${command.weight} 克，金额 ${command.amount}`




}









// 进货


if(command.type==='purchase'){





if(command.weight===undefined){


return '没有识别到重量'


}





if(command.amount===undefined){


return '没有识别到成本'


}







data.stock += command.weight



data.cost += command.amount



data.totalWeightCost += command.amount






saveInventory(data)







saveRecord({


type:'purchase',


date:new Date().toLocaleString(),


weight:
command.weight,


amount:
command.amount



})







return `进货成功 ${command.weight} 克`




}







return null


}
