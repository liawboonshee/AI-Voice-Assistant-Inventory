import { useEffect, useState } from 'react'
import { addEmployee, employeeStock, heldStock, loadEmployees, ownerStock, stockError } from './EmployeesData'
import { currentRecordDate, loadRecords, saveRecord } from './Records'
import { loadInventory } from './Storage'
import { formatRecordDate, isSameLocalDay, recordCashIn } from './Analytics'

export default function Employees({ onSale }: { onSale: (id: string) => void }) {
  const [employees, setEmployees] = useState(loadEmployees)
  const [records, setRecords] = useState(loadRecords)
  const [total, setTotal] = useState(() => loadInventory().stock)
  const [selected, setSelected] = useState('')
  const [name, setName] = useState('')
  const [weight, setWeight] = useState('')
  const [movement, setMovement] = useState<'give' | 'return'>('give')
  const [note, setNote] = useState('')
  const [message, setMessage] = useState('')
  const refresh = () => { setEmployees(loadEmployees()); setRecords(loadRecords()); setTotal(loadInventory().stock) }
  useEffect(() => { const timer = window.setInterval(refresh, 700); return () => window.clearInterval(timer) }, [])
  const current = employees.find(e => e.id === selected)
  const history = records.filter(item => item.employeeId === selected)
  function create() {
    try { const employee = addEmployee(name); setSelected(employee.id); setName(''); refresh(); setMessage('✅ 员工已新增') }
    catch (error) { setMessage(error instanceof Error ? error.message : '保存失败') }
  }
  function transfer() {
    if (!current) { setMessage('请先选择员工'); return }
    const w = Math.round(Number(weight) * 100) / 100
    const list = loadRecords()
    const stock = loadInventory().stock
    const error = stockError(stock, list, w, movement === 'return' ? selected : '')
    if (error) { setMessage(error); return }
    try {
      saveRecord({ type: 'adjustment', date: currentRecordDate(), weight: w, amount: 0,
        employeeId: current.id, employeeName: current.name, employeeMovement: movement,
        note: note.trim(), stockAfter: stock })
      refresh(); setWeight(''); setNote(''); setMessage(`✅ 已${movement === 'give' ? '分货给' : '收回'}${current.name} ${w.toFixed(2)}G`)
    } catch { setMessage('保存失败，请检查手机存储空间') }
  }
  return <div className="employee-page">
    <h1>👥 员工存货 / 出货</h1>
    <section className="employee-summary">
      <div><span>你手里</span><strong>{ownerStock(total, records).toFixed(2)}G</strong></div>
      <div><span>员工手里合计</span><strong>{heldStock(records).toFixed(2)}G</strong></div>
      <div><span>全部未售库存</span><strong>{total.toFixed(2)}G</strong></div>
    </section>
    <p>分货和退货不算销售收入。员工出货时才扣总库存；由你在这台手机统一记账。</p>
    <div className="employee-add"><input aria-label="新员工名字" value={name} onChange={e => setName(e.target.value)} placeholder="员工名字" /><button type="button" onClick={create}>新增员工</button></div>
    {message && <p role="status">{message}</p>}
    {employees.length === 0 && <p>先新增员工，再记录分货。</p>}
    <div className="employee-cards">{employees.map(employee => {
      const sales = records.filter(item => item.employeeId === employee.id && item.type === 'sale')
      return <button type="button" key={employee.id} className={selected === employee.id ? 'employee-card active' : 'employee-card'} onClick={() => { setSelected(employee.id); setWeight(''); setMessage('') }}>
        <strong>{employee.name}</strong><b>{employeeStock(records, employee.id).toFixed(2)}G</b>
        <span>今日出货 {sales.filter(item => isSameLocalDay(item.date)).reduce((sum, item) => sum + item.weight, 0).toFixed(2)}G</span>
        <span>累计出货 {sales.reduce((sum, item) => sum + item.weight, 0).toFixed(2)}G · 已收 RM{sales.reduce((sum, item) => sum + recordCashIn(item), 0).toFixed(2)}</span>
      </button>
    })}</div>
    {current && <section className="employee-detail">
      <h2>{current.name} · 手里 {employeeStock(records, current.id).toFixed(2)}G</h2>
      <button type="button" onClick={() => onSale(current.id)}>📤 记录这位员工出货</button>
      <label>货品移动<select value={movement} onChange={e => setMovement(e.target.value as 'give' | 'return')}><option value="give">分货给员工</option><option value="return">员工退回给我</option></select></label>
      <label>重量（G）<input type="number" min="0.01" step="0.01" value={weight} onChange={e => setWeight(e.target.value)} /></label>
      <label>备注（可选）<input value={note} onChange={e => setNote(e.target.value)} /></label>
      <button type="button" onClick={transfer}>保存{movement === 'give' ? '分货' : '退货'}</button>
      <h2>这位员工的记录</h2>
      {history.length === 0 && <p>暂无记录</p>}
      {history.slice().reverse().map((item, index) => <article className="employee-history" key={`${item.date}-${index}`}>
        <strong>{item.employeeMovement === 'give' ? '📦 分货' : item.employeeMovement === 'return' ? '↩️ 退货' : item.type === 'sale' ? '📤 出货' : '💰 还款'} · {item.weight.toFixed(2)}G</strong>
        <small>{formatRecordDate(item.date)}</small>
        {item.customer && <p>顾客：{item.customer}</p>}
        {item.type === 'sale' && <p>售价 RM{item.amount.toFixed(2)} · 已收 RM{recordCashIn(item).toFixed(2)} · 本次欠款 RM{(item.debtAmount || 0).toFixed(2)}</p>}
        {item.note && <p>{item.note}</p>}
      </article>)}
    </section>}
  </div>
}
