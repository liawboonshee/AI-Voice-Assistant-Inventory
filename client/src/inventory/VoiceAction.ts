import { loadInventory, saveInventory } from './Storage'
import { saveRecord } from './Records'
import { parseVoiceCommand } from './VoiceCommand'



export function executeVoiceCommand(text:string){


const command=parseVoiceCommand(text)


const data=loadInventory()






// 查询

if(command.type==='query'){


return `目前库存 ${data.stock.toFixed(2)} 克`


}









// 出货

if(command.type==='sale'){



if(!command.weight){


return '没有识别到重量'


}



if(!command.amount){


return '没有识别到金额'


}





if(data.stock < command.weight){


return '库存不足'


}







// 记录出货前库存

const oldStock =
data.stock





// 计算平均成本

const costPerGram =

oldStock > 0 && data.cost

?

data.cost / oldStock

:

0






// 本次成本

const saleCost =

costPerGram * command.weight








// 扣库存

data.stock -= command.weight






// 增加收入

data.income += command.amount







// 正确利润

data.profit +=

command.amount - saleCost







saveInventory(data)








saveRecord({


type:'sale',


date:new Date().toLocaleString(),


customer:command.customer || '未填写',


weight:command.weight,


amount:command.amount


})







return `出货成功 ${command.weight} 克，金额 ${command.amount}`



}











// 进货

if(command.type==='purchase'){



if(!command.weight){


return '没有识别到重量'


}





if(!command.amount){


return '没有识别到成本'


}







data.stock += command.weight





data.cost += command.amount





saveInventory(data)








saveRecord({


type:'purchase',


date:new Date().toLocaleString(),


weight:command.weight,


amount:command.amount


})







return `进货成功 ${command.weight} 克`



}








return null


}
