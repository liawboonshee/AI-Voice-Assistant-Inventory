import { parseVoiceCommand } from './VoiceCommand'
import { loadInventory, saveInventory } from './Storage'
import { saveRecord } from './Records'


export function executeVoiceCommand(text:string){


  const command =
    parseVoiceCommand(text)



  if(!command.type){

    return null

  }




  // =================
  // 出货
  // =================

  if(command.type === 'sale'){


    const data =
      loadInventory()



    if(!command.weight){

      return '请输入出货重量'

    }



    if(data.stock < command.weight){

      return '库存不足'

    }



    data.stock -= command.weight



    const amount =
      command.amount || 0



    data.income += amount

    data.profit += amount



    saveInventory(data)



    saveRecord({

      type:'sale',

      date:new Date().toLocaleString(),

      customer:
        command.customer || '未填写',

      weight:
        command.weight,

      amount

    })



    return `✅ 出货${command.weight}克成功`

  }







  // =================
  // 进货
  // =================

  if(command.type === 'purchase'){



    const data =
      loadInventory()



    if(!command.weight){

      return '请输入进货重量'

    }




    data.stock += command.weight



    saveInventory(data)



    saveRecord({

      type:'purchase',

      date:new Date().toLocaleString(),

      weight:
        command.weight,

      amount:
        command.amount || 0

    })



    return `✅ 进货${command.weight}克成功`

  }






  // =================
  // 查询交给 InventoryAI
  // =================


  return null


}
