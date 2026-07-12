// 记录出货前本金

const oldStock = data.stock


// 当前每克本金

const costPerGram =
oldStock > 0
?
data.totalWeightCost / oldStock
:
0



// 本次卖出的本金

const saleCost =
costPerGram * command.weight



// 扣库存

data.stock -= command.weight



// 扣库存本金

data.totalWeightCost -= saleCost



if(data.totalWeightCost < 0){

data.totalWeightCost = 0

}



// 增加收入

data.income += command.amount



// 真实利润

data.profit += command.amount - saleCost
