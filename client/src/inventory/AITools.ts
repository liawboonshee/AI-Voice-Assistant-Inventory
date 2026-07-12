import { askInventory } from './InventoryAI'
import { executeVoiceCommand } from './VoiceAction'



export function runInventoryTool(text:string){



  // 先执行库存动作

  const actionAnswer =
    executeVoiceCommand(text)



  if(actionAnswer){

    return actionAnswer

  }




  // 再执行库存查询

  const queryAnswer =
    askInventory(text)



  if(queryAnswer){

    return queryAnswer

  }



  return null


}
