import { executeVoiceCommand } from './VoiceAction'
import { askInventory } from './InventoryAI'


export function runInventoryTool(text:string){


  // 先执行库存操作

  const action =
    executeVoiceCommand(text)



  if(action){

    return action

  }




  // 查询库存

  const answer =
    askInventory(text)



  if(answer){

    return answer

  }



  return null

}
