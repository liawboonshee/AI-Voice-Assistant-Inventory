export const PACKS = [
  { key: 'g1', label: '1 G', units: 100 },
  { key: 'g053', label: '0.53 G', units: 53 },
  { key: 'g040', label: '0.4 G', units: 40 },
  { key: 'g025', label: '0.25 G', units: 25 },
  { key: 'g250', label: '2.5 G', units: 250 },
  { key: 'g625', label: '6.25 G', units: 625 },
] as const
export type PackKey = typeof PACKS[number]['key']
export type PackCounts = Record<PackKey, number>
export type PackInputs = Record<PackKey, string>
export const emptyPacks = (): PackCounts => ({ g1: 0, g053: 0, g040: 0, g025: 0, g250: 0, g625: 0 })
export const emptyPackInputs = (): PackInputs => ({ g1: '', g053: '', g040: '', g025: '', g250: '', g625: '' })
export function validPacks(value: unknown): value is PackCounts {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  return PACKS.every(pack => {
    const n = (value as Record<string, unknown>)[pack.key]
    return typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 && n <= 1000000
  })
}
export function parsePacks(inputs: PackInputs): PackCounts {
  const result = emptyPacks()
  for (const pack of PACKS) {
    const raw = inputs[pack.key].trim()
    const n = raw === '' ? 0 : Number(raw)
    if (!Number.isSafeInteger(n) || n < 0 || n > 1000000) throw new Error(`${pack.label}的数量必须是0到1000000之间的整数`)
    result[pack.key] = n
  }
  return result
}
export function packsWeight(counts: PackCounts): number {
  return PACKS.reduce((sum, pack) => sum + pack.units * counts[pack.key], 0) / 100
}
export function packSummary(counts: PackCounts, includeZero = false): string {
  return PACKS.filter(pack => includeZero || counts[pack.key] !== 0)
    .map(pack => `${pack.label} × ${counts[pack.key]}个`).join(' · ')
}
