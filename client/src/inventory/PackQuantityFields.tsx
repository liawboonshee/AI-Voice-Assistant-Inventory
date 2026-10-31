import { PACKS, parsePacks, packsWeight, type PackInputs } from './Packs'
export default function PackQuantityFields({ value, onChange }: { value: PackInputs; onChange: (value: PackInputs) => void }) {
  let weight = 0, count = 0, error = ''
  try { const counts = parsePacks(value); weight = packsWeight(counts); count = Object.values(counts).reduce((a, b) => a + b, 0) }
  catch (cause) { error = cause instanceof Error ? cause.message : '数量不正确' }
  return <section className="pack-fields">
    <h3>按规格填写数量</h3>
    <div className="pack-grid">{PACKS.map(pack => <label className="pack-field" key={pack.key}>
      <strong>{pack.label}</strong>
      <span className="pack-stepper">
        <button type="button" aria-label={`减少${pack.label}`} disabled={!Number(value[pack.key]) || Number(value[pack.key]) <= 0} onClick={() => onChange({ ...value, [pack.key]: String(Math.max(0, Math.floor(Number(value[pack.key]) || 0) - 1)) })}>−</button>
        <input aria-label={`${pack.label}数量`} type="number" inputMode="numeric" min="0" max="1000000" step="1" placeholder="0" value={value[pack.key]} onChange={e => onChange({ ...value, [pack.key]: e.target.value })} />
        <button type="button" aria-label={`增加${pack.label}`} onClick={() => onChange({ ...value, [pack.key]: String(Math.min(1000000, Math.max(0, Math.floor(Number(value[pack.key]) || 0)) + 1)) })}>+</button>
      </span><small>个</small>
    </label>)}</div>
    {error ? <p role="alert">{error}</p> : <p className="pack-total">共 <strong>{count}</strong> 个 · 合计 <strong>{weight.toFixed(2)} G</strong></p>}
  </section>
}
