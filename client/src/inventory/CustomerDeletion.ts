export type DeletableCustomer = { name: string; debt: number }

export function deleteCustomerProfile<T extends DeletableCustomer>(storage: Pick<Storage, 'getItem' | 'setItem'>, name: string): {ok:true; customers:T[]} | {ok:false; message:string} {
  try {
    const data: unknown = JSON.parse(storage.getItem('customers') || '[]')
    if (!Array.isArray(data) || !data.every(item => item && typeof item.name === 'string')) {
      return {ok:false, message:'顾客资料异常，未删除，请先备份。'}
    }
    const matches = data.filter(item => item.name === name)
    if (matches.length !== 1) return {ok:false, message:'找不到唯一顾客，未删除。'}
    const customer = matches[0]
    if (typeof customer.debt !== 'number' || !Number.isFinite(customer.debt) || customer.debt !== 0) {
      return {ok:false, message:'顾客仍有欠款或余额异常，请先结清再删除。'}
    }
    const customers = data.filter(item => item.name !== name) as T[]
    storage.setItem('customers', JSON.stringify(customers))
    return {ok:true, customers}
  } catch {
    return {ok:false, message:'删除失败，请检查储存空间后重试。'}
  }
}
