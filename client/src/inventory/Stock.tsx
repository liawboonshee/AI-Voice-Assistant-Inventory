import { useEffect, useState } from 'react'
import { loadInventory } from './Storage'


export default function Stock() {

  const [stock, setStock] = useState(0)


  useEffect(() => {

    const update = () => {

      const data = loadInventory()

      setStock(data.stock)

    }


    update()


    const timer = setInterval(update, 500)


    return () => clearInterval(timer)


  }, [])



  return (

    <div style={{padding:24}}>

      <h1>📦 库存</h1>

      <h2>
        剩余库存：
        {stock.toFixed(2)} g
      </h2>

    </div>

  )

}
