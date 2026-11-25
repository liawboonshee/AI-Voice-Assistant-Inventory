export type InventoryData = {

  stock:number

  redWineStock?:number

  income:number

  profit:number

  cost:number

  // 当前库存总本金
  totalWeightCost:number

}



const KEY='inventory_data'



const defaultData:InventoryData={

  stock:0,

  redWineStock:0,

  income:0,

  profit:0,

  cost:0,

  totalWeightCost:0

}



export function loadInventory():InventoryData{


const data=localStorage.getItem(KEY)



if(!data){

return { ...defaultData }

}



const result=JSON.parse(data)



// 兼容旧数据

if(result.totalWeightCost===undefined){

result.totalWeightCost=0

}



if (!Number.isSafeInteger(result.redWineStock) || result.redWineStock < 0) result.redWineStock = 0

return result



}



export function saveInventory(data:InventoryData){


localStorage.setItem(

KEY,

JSON.stringify(data)

)


}

export const RED_WINE_UNIT_COST = 8.5

export function redWineStock(data: InventoryData): number {
  return data.redWineStock ?? 0
}
