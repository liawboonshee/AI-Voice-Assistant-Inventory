export type InventoryQuery =
  | 'stock'
  | 'income'
  | 'profit'
  | 'sales'
  | 'purchases'
  | 'records'
  | 'debt'
  | 'cost'
  | 'summary'
  | 'last'

export type VoiceCommand = {
  type: 'sale' | 'purchase' | 'income' | 'query' | null
  query?: InventoryQuery
  shortcut?: boolean
  paymentSpoken?: boolean
  needsCustomer?: boolean
  spokenCustomer?: string
  error?: string
  customer?: string
  weight?: number
  amount?: number
  debtAmount?: number
  paidAmount?: number
  cashAmount?: number
  transferAmount?: number
  isDebt?: boolean
  paymentMethod?: 'cash' | 'transfer' | 'debt' | 'mixed'
}

type NumberToken = {
  raw: string
  value: number
  index: number
  end: number
}

const CHINESE_DIGITS: Record<string, number> = {
  零: 0,
  〇: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
}

const CHINESE_UNITS: Record<string, number> = {
  十: 10,
  百: 100,
  千: 1000,
  万: 10_000,
}

const NUMBER_SOURCE =
  String.raw`(?:(?:[1-9一二两三四五六七八九]?[百千][1-9](?![\d百千万十点.])|[1-9][百千][一二两三四五六七八九](?![零〇一二两三四五六七八九十百千万点]))|\d+(?:,\d{3})*(?:\.\d+)?|[零〇一二两三四五六七八九十百千万]+(?:点[零〇一二两三四五六七八九]+)?|半)`

const WEIGHT_UNIT_SOURCE = '公斤|千克|kg|斤|公克|克|grams?|gram|g|毫克|mg'

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 65_248))
    .replace(/。(?=\d)/g, '.')
    .replace(/([零〇一二两三四五六七八九十百千万])\.([零〇一二两三四五六七八九])/g, '$1点$2')
    .replace(/公厘克/g, '毫克')
    .replace(/公斤重/g, '公斤')
    .replace(/元钱/g, '元')
    // Google 中文语音经常把库存口令听成同音词，先纠正再解析数字。
    .replace(/听话|听货|进化|近货|净货|镜货|进活|今货|金货|经过|进过|进口|进购|进够|劲货|禁货|静候|今后/g, '进货')
    .replace(/吃货|出活|出和|出河/g, '出货')
    // 保留两个独立数字之间的边界，例如“进货 125 4500”。
    .replace(/([0-9零〇一二两三四五六七八九十百千万半])\s+(?=[0-9零〇一二两三四五六七八九十百千万半])/g, '$1；')
    .replace(/\s+/g, '')
    .trim()
}

function parseChineseInteger(text: string): number | null {
  if (!text) return null

  if (!/[十百千万]/.test(text)) {
    let digits = ''
    for (const char of text) {
      const digit = CHINESE_DIGITS[char]
      if (digit === undefined) return null
      digits += String(digit)
    }
    return digits ? Number(digits) : null
  }

  let total = 0
  let section = 0
  let current = 0

  for (const char of text) {
    const digit = CHINESE_DIGITS[char]
    if (digit !== undefined) {
      current = digit
      continue
    }

    const unit = CHINESE_UNITS[char]
    if (unit === undefined) return null

    if (unit === 10_000) {
      section = (section + current) * unit
      total += section
      section = 0
      current = 0
      continue
    }

    section += (current || 1) * unit
    current = 0
  }

  return total + section + current
}

// Malaysian Mandarin commonly omits the initial 一 in 百五 / 千五.
const VAGUE_AMOUNT = /(?:[一二两三四五六七八九1-9]?[百千](?:几多|几|多|来|余)|(?:\d+|[零〇一二两三四五六七八九十百千万]+)多(?:块|元|马币)?)/

function colloquialNumber(text: string): number | null {
  const short = /^([1-9一二两三四五六七八九]?)([百千])([1-9一二两三四五六七八九])$/.exec(text)
  if (!short) return null
  const digit = (value: string) => CHINESE_DIGITS[value] ?? Number(value)
  const scale = short[2] === '百' ? 100 : 1000
  return (short[1] ? digit(short[1]) : 1) * scale + digit(short[3] ?? '') * scale / 10
}

export function parseSpokenNumber(raw: string): number | null {
  const text = raw.trim().replace(/，/g, ',')
  if (!text) return null
  if (text === '半') return 0.5
  if (VAGUE_AMOUNT.test(text)) return null
  const colloquial = colloquialNumber(text)
  if (colloquial !== null) return colloquial

  if (/^\d+(?:,\d{3})*(?:\.\d+)?$/.test(text)) {
    const value = Number(text.replace(/,/g, ''))
    return Number.isFinite(value) ? value : null
  }

  const [integerText = '', decimalText] = text.split('点')
  const integer = parseChineseInteger(integerText)
  if (integer === null) return null
  if (decimalText === undefined) return integer

  let decimalDigits = ''
  for (const char of decimalText) {
    const digit = CHINESE_DIGITS[char]
    if (digit === undefined) return null
    decimalDigits += String(digit)
  }

  return decimalDigits ? Number(`${integer}.${decimalDigits}`) : integer
}

function extractNumberTokens(text: string): NumberToken[] {
  const pattern = new RegExp(NUMBER_SOURCE, 'g')
  const tokens: NumberToken[] = []

  for (const match of text.matchAll(pattern)) {
    const raw = match[0]
    const value = parseSpokenNumber(raw)
    const index = match.index ?? 0
    if (value === null || !Number.isFinite(value)) continue
    tokens.push({ raw, value, index, end: index + raw.length })
  }

  return tokens
}

export function extractFirstSpokenNumber(text: string): number | null {
  const normalized = normalizeText(text)
  if (VAGUE_AMOUNT.test(normalized)) return null
  return extractNumberTokens(normalized)[0]?.value ?? null
}

function convertWeight(value: number, unit: string): number {
  if (unit === '公斤' || unit === '千克' || unit === 'kg') return value * 1000
  if (unit === '斤') return value * 500
  if (unit === '毫克' || unit === 'mg') return value / 1000
  return value
}

function maskRange(text: string, index: number, length: number): string {
  return `${text.slice(0, index)}${' '.repeat(length)}${text.slice(index + length)}`
}

function extractCustomer(text: string): string | undefined {
  const directPatterns = [
    /(?:卖给|卖予|出货给|销售给|给客户|给)(.+)/,
    /客户(?:是|叫|为)?(.+)/,
  ]

  for (const pattern of directPatterns) {
    const match = text.match(pattern)
    const rest = match?.[1]
    if (!rest) continue

    const stop = new RegExp(
      `${NUMBER_SOURCE}|${WEIGHT_UNIT_SOURCE}|总价|售价|价格|金额|货款|欠款|欠|赊账|记账|挂账|已付|实收|收到|先付|付了|[，,。；;]`,
      'i',
    )
    const name = rest.split(stop)[0]?.replace(/^(客户|顾客)/, '').trim()
    if (name && name !== '我') return name
  }

  return undefined
}

function extractDebtQueryCustomer(text: string): string | undefined {
  const match = text.match(/(?:请问|帮我查|查询|查一下|查|看看)?(.+?)(?:还)?欠(?:款)?(?:多少|多少钱|几多)/)
  const name = match?.[1]
    ?.replace(/^(客户|顾客)/, '')
    .replace(/的$/, '')
    .trim()
  return name || undefined
}

/** Personal pronunciation samples are confirmed speech-to-text aliases, not voiceprints. */
export function normalizeCustomerAlias(raw: string): string {
  let value = raw.normalize('NFKC').toLowerCase().replace(/[\s,，。.;；:：!?！？、]/g,'')
  if (/^[零〇一二两三四五六七八九0-9]+$/.test(value)) {
    value = Array.from(value, c => CHINESE_DIGITS[c] === undefined ? c : String(CHINESE_DIGITS[c])).join('')
  }
  return value
}

function loadVoiceCustomers(): {name:string; voiceAliases?:string[]}[] {
  try {
    if (typeof localStorage === 'undefined') return []
    const data: unknown = JSON.parse(localStorage.getItem('customers') || '[]')
    if (!Array.isArray(data)) return []
    return data.filter(item => typeof item?.name === 'string' && item.name.trim())
  } catch { return [] }
}

export function matchCustomerAlias(raw: string, customers = loadVoiceCustomers()): {name?: string; ambiguous: boolean} {
  const key = normalizeCustomerAlias(raw)
  if (!key) return {ambiguous:false}
  const matches = customers.filter(item => normalizeCustomerAlias(item.name) === key ||
    (Array.isArray(item.voiceAliases) && item.voiceAliases.some(alias => typeof alias === 'string' && normalizeCustomerAlias(alias) === key)))
  const names = [...new Set(matches.map(item => item.name))]
  return names.length === 1 ? {name:names[0], ambiguous:false} : {ambiguous:names.length > 1}
}

function loadKnownCustomerNames(): string[] {
  try {
    if (typeof localStorage === 'undefined') return []
    const data = JSON.parse(localStorage.getItem('customers') || '[]')
    if (!Array.isArray(data)) return []
    return data
      .map((item) => (typeof item?.name === 'string' ? item.name.trim() : ''))
      .filter(Boolean)
      .filter((name, index, list) => list.indexOf(name) === index)
      .sort((left, right) => right.length - left.length)
  } catch {
    return []
  }
}

function cleanCustomerCandidate(text: string): string {
  return text
    .replace(/[\s，,。；;!?！？:：]/g, '')
    .replace(/^(?:客户|顾客)(?:是|叫|为)?/, '')
    .replace(/^(?:是|叫)/, '')
    .replace(/(?:的)?(?:欠款?|还欠)(?:多少|多少钱|几多)?$/, '')
    .trim()
}

const CUSTOMER_HOMOPHONE_GROUPS = [
  '健建剑坚键', '明鸣铭名', '伟炜纬玮', '华花桦', '杰洁捷婕', '林琳霖', '平萍苹',
  '欣新心鑫馨', '丽莉利俐', '英莹瑛', '俊军君钧', '芳方', '文雯纹', '强墙',
  '宏鸿洪红弘', '凯恺铠', '豪浩昊', '勇永咏', '峰锋丰', '宇雨羽禹', '佳嘉家',
  '慧惠汇', '婷庭廷', '彬斌', '成诚程', '东冬', '龙隆', '宁凝', '玲灵铃',
  '霞侠', '香湘', '佩沛', '燕艳', '志智治', '祥翔', '阳杨洋',
]

function sameCustomerSound(left: string, right: string): boolean {
  return left === right || CUSTOMER_HOMOPHONE_GROUPS.some(
    (group) => group.includes(left) && group.includes(right),
  )
}

function nameDistance(left: string, right: string): number {
  const rows = Array.from({ length: left.length + 1 }, (_, index) => index)
  for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
    let diagonal = rows[0] ?? 0
    rows[0] = rightIndex
    for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
      const previous = rows[leftIndex] ?? 0
      rows[leftIndex] = sameCustomerSound(left[leftIndex - 1] ?? '', right[rightIndex - 1] ?? '')
        ? diagonal
        : Math.min(diagonal, previous, rows[leftIndex - 1] ?? 0) + 1
      diagonal = previous
    }
  }
  return rows[left.length] ?? Math.max(left.length, right.length)
}

/**
 * 用库存宝里已保存的顾客名单校正语音姓名。
 * 先做完整姓名匹配，再允许一个汉字的语音同音/错字误差；同分时不猜。
 */
export function resolveKnownCustomerName(input: string): string | undefined {
  const names = loadKnownCustomerNames()
  if (names.length === 0) return undefined

  const normalizedInput = normalizeText(input)
  const direct = matchCustomerAlias(input)
  if (direct.ambiguous) return undefined
  if (direct.name) return direct.name

  const candidate = cleanCustomerCandidate(
    extractCustomer(normalizedInput) ?? extractDebtQueryCustomer(normalizedInput) ?? normalizedInput,
  )
  if (!candidate) return undefined

  const learned = matchCustomerAlias(candidate)
  if (learned.ambiguous) return undefined
  if (learned.name) return learned.name
  const embedded = names.find((name) => normalizedInput.includes(normalizeText(name)))
  if (embedded) return embedded
  const exact = names.find((name) => normalizeText(name) === candidate)
  if (exact) return exact

  const ranked = names
    .map((name) => ({ name, distance: nameDistance(normalizeText(name), candidate) }))
    .sort((left, right) => left.distance - right.distance)
  const best = ranked[0]
  if (!best || best.distance > 1) return undefined
  if (ranked[1]?.distance === best.distance) return undefined
  return best.name
}

/** Android 会返回多个听写候选，优先选择包含已保存顾客姓名的完整口令。 */
export function scoreCustomerTranscript(input: string): number {
  const normalized = normalizeText(input)
  const names = loadKnownCustomerNames()
  const exactCustomer = names.some((name) => normalized.includes(normalizeText(name)))
  const resolvedCustomer = exactCustomer ? undefined : resolveKnownCustomerName(normalized)
  const hasAction = /进货|入货|补货|采购|买入|收货|出货|卖给|销售|出售|卖出|售出/.test(normalized)
  const hasQuery = /库存|利润|收入|欠款|欠多少|交易|记录/.test(normalized)
  const shortcut = parseTakeSale(input)
  if (shortcut) return shortcut.error ? 0 : 200 + (!shortcut.needsCustomer ? 160 : 0) + (shortcut.paymentSpoken ? 15 : 0)
  return (exactCustomer ? 100 : resolvedCustomer ? 60 : 0) + (hasAction ? 25 : 0) + (hasQuery ? 10 : 0)
}

function detectQuery(text: string): InventoryQuery | undefined {
  const questionLike =
    /多少|几笔|几多|查询|查一下|帮我查|看看|目前|现在|总共|总计|情况|概况|报表|上一笔|最近一笔|最后一笔/.test(
      text,
    ) || /[?？吗呢]$/.test(text)

  if (!questionLike) return undefined
  if (/上一笔|最近一笔|最后一笔/.test(text)) return 'last'
  if (/欠款|欠多少钱|欠多少|赊账|挂账/.test(text)) return 'debt'
  if (/利润|盈利|赚了多少|赚多少/.test(text)) return 'profit'
  if (/库存|存货|剩下|剩余|还有多少/.test(text)) return 'stock'
  if (/进货量|总进货|入货量|进了多少|买入多少/.test(text)) return 'purchases'
  if (/出货量|总出货|销量|销售量|卖了多少|出了多少/.test(text)) return 'sales'
  if (/交易|记录|几笔/.test(text)) return 'records'
  if (/成本|本金|平均成本/.test(text)) return 'cost'
  if (/收入|营业额|收了多少|收到多少/.test(text)) return 'income'
  if (/情况|概况|报表|怎么样/.test(text)) return 'summary'
  return undefined
}

function parseWeight(text: string): { value?: number; masked: string } {
  const explicitPattern = new RegExp(`(${NUMBER_SOURCE})(${WEIGHT_UNIT_SOURCE})`, 'i')
  const explicit = explicitPattern.exec(text)

  if (explicit) {
    const number = parseSpokenNumber(explicit[1] ?? '')
    const unit = explicit[2] ?? '克'
    if (number !== null) {
      return {
        value: convertWeight(number, unit),
        masked: maskRange(text, explicit.index, explicit[0].length),
      }
    }
  }

  const labelledPattern = new RegExp(`(?:重量|重)[:：]?(${NUMBER_SOURCE})`, 'i')
  const labelled = labelledPattern.exec(text)
  if (labelled) {
    const number = parseSpokenNumber(labelled[1] ?? '')
    if (number !== null) {
      return {
        value: number,
        masked: maskRange(text, labelled.index, labelled[0].length),
      }
    }
  }

  return { masked: text }
}

function parseActionDetails(text: string, type: 'sale' | 'purchase'): Omit<VoiceCommand, 'type'> {
  const result: Omit<VoiceCommand, 'type'> = {}
  const parsedWeight = parseWeight(text)
  let remainder = parsedWeight.masked

  if (parsedWeight.value !== undefined) result.weight = parsedWeight.value
  if (type === 'sale') result.customer = resolveKnownCustomerName(text) ?? extractCustomer(text)

  const debtPattern = new RegExp(`(?:欠款?|赊账|挂账|记账)[:：]?(${NUMBER_SOURCE})`, 'i')
  const debtMatch = debtPattern.exec(remainder)
  if (debtMatch) {
    const debtAmount = parseSpokenNumber(debtMatch[1] ?? '')
    if (debtAmount !== null) result.debtAmount = debtAmount
    result.isDebt = true
    remainder = maskRange(remainder, debtMatch.index, debtMatch[0].length)
  } else if (/欠款|赊账|挂账|记账|未付款|没给钱|还没付/.test(text)) {
    result.isDebt = true
  }

  if (type === 'sale') {
    const cashPattern = new RegExp(`(?:收现金|现金|现收)[:：]?(${NUMBER_SOURCE})`, 'i')
    const cashMatch = cashPattern.exec(remainder)
    if (cashMatch) {
      const cashAmount = parseSpokenNumber(cashMatch[1] ?? '')
      if (cashAmount !== null) result.cashAmount = cashAmount
      remainder = maskRange(remainder, cashMatch.index, cashMatch[0].length)
    }

    const transferPattern = new RegExp(`(?:转账|转帐|银行|电子钱包)[:：]?(${NUMBER_SOURCE})`, 'i')
    const transferMatch = transferPattern.exec(remainder)
    if (transferMatch) {
      const transferAmount = parseSpokenNumber(transferMatch[1] ?? '')
      if (transferAmount !== null) result.transferAmount = transferAmount
      remainder = maskRange(remainder, transferMatch.index, transferMatch[0].length)
    }

    const methodCount = [
      (result.cashAmount || 0) > 0,
      (result.transferAmount || 0) > 0,
      (result.debtAmount || 0) > 0,
    ].filter(Boolean).length
    result.paymentMethod = methodCount > 1
      ? 'mixed'
      : (result.debtAmount || 0) > 0 || /欠款|赊账|挂账|记账|未付款|没给钱|还没付/.test(text)
        ? 'debt'
        : (result.transferAmount || 0) > 0 || /转账|转帐|银行|电子钱包/.test(text)
          ? 'transfer'
          : 'cash'
  }

  const paidPattern = new RegExp(`(?:已付|实收|收到|先付|付了)[:：]?(${NUMBER_SOURCE})`, 'i')
  const paidMatch = paidPattern.exec(remainder)
  if (paidMatch) {
    const paidAmount = parseSpokenNumber(paidMatch[1] ?? '')
    if (paidAmount !== null) result.paidAmount = paidAmount
    remainder = maskRange(remainder, paidMatch.index, paidMatch[0].length)
  }

  const amountKeyword =
    type === 'purchase'
      ? '总成本|成本|货款|价格|金额|总价|一共|共|花(?:了)?|用(?:了)?|rm|rmb|马币'
      : '总售价|售价|总价|价格|金额|货款|一共|共|收(?:了)?|卖(?:了)?|rm|rmb|马币'
  const labelledAmountPattern = new RegExp(`(?:${amountKeyword})[:：]?(${NUMBER_SOURCE})`, 'i')
  const labelledAmount = labelledAmountPattern.exec(remainder)

  if (labelledAmount) {
    const amount = parseSpokenNumber(labelledAmount[1] ?? '')
    if (amount !== null) result.amount = amount
    remainder = maskRange(remainder, labelledAmount.index, labelledAmount[0].length)
  }

  const looseNumbers = extractNumberTokens(remainder)
  if (result.weight === undefined && looseNumbers.length > 0) {
    result.weight = looseNumbers.shift()?.value
  }
  if (result.amount === undefined && looseNumbers.length > 0) {
    result.amount = looseNumbers[0]?.value
  }

  if (
    result.amount !== undefined &&
    result.paidAmount !== undefined &&
    result.debtAmount === undefined
  ) {
    result.debtAmount = Math.max(0, result.amount - result.paidAmount)
    result.isDebt = result.debtAmount > 0
  }

  if (type === 'sale' && (result.cashAmount !== undefined || result.transferAmount !== undefined)) {
    result.paidAmount = (result.cashAmount || 0) + (result.transferAmount || 0)
  }

  if (
    type === 'sale' &&
    result.amount === undefined &&
    (result.cashAmount !== undefined || result.transferAmount !== undefined || result.debtAmount !== undefined)
  ) {
    result.amount = (result.cashAmount || 0) + (result.transferAmount || 0) + (result.debtAmount || 0)
  }

  return result
}


const QUICK_VOICE_WEIGHTS: Readonly<Record<number, number>> = {50:0.25,80:0.4,100:0.55,150:1,300:2.5}
const DEBT_WORDS = '还欠款|还欠|剩下欠|剩欠|欠款|欠账|欠帐|欠钱|欠了|欠|赊账|挂账|未付|没付'
const DEBT_HOMOPHONES = '钱款|钱|签|千|牵|谦|前|歉|芡|迁|铅|钎'
const CASH_WORDS = '收现金|收款|收钱|现金|现收|实收|收到|收了|收|首|手|守'
const TRANSFER_WORDS = '转账|转帐'
const CURRENCY_WORDS = '马币|块钱|块|元|rm'

/** Customer IDs are strings, not amounts. Never fuzzy-match a numeric ID. */
function shortcutCustomerName(raw: string): string {
  let name = raw.replace(/[\s,，。；;：:]/g,'').replace(/^(?:顾客|客户)/,'')
  if (/^[零〇一二两三四五六七八九0-9]+$/.test(name)) {
    name = Array.from(name, c => CHINESE_DIGITS[c] === undefined ? c : String(CHINESE_DIGITS[c])).join('')
  }
  return name
}

function shortcutNumber(raw: string): number | null {
  return parseSpokenNumber(raw)
}

/** Only propose names; similar numeric IDs must never be auto-corrected. */
export function suggestVoiceCustomers(raw: string): string[] {
  const key = normalizeCustomerAlias(raw)
  if (!key) return []
  return loadVoiceCustomers().map(item => ({
    name:item.name,
    distance:Math.min(...[item.name,...(Array.isArray(item.voiceAliases) ? item.voiceAliases.filter(alias => typeof alias === 'string') : [])]
      .map(alias => nameDistance(normalizeCustomerAlias(alias),key))),
  })).filter(item => item.distance <= Math.max(1, Math.floor(key.length/3)))
    .sort((a,b) => a.distance-b.distance || a.name.localeCompare(b.name)).slice(0,8).map(item => item.name)
}

/** Split a name and an explicit gram phrase even when 拿 was omitted or misheard. */
function splitTakeSale(raw: string): {name:string; tail:string} | undefined {
  const direct = /^(.*?)(?:拿|拏)(.*)$/.exec(raw)
  if (direct) return {name:direct[1] ?? '',tail:direct[2] ?? ''}
  if (/^(?:进货|入货|补货|采购|买入|收货|出货|卖给|卖予|销售|出售|卖出|售出|收入|收款|记录收入|其他收入|现金收入)/.test(normalizeText(raw))) return undefined
  const head = new RegExp('^\\s*(?:' + NUMBER_SOURCE + ')\\s*(?:' + WEIGHT_UNIT_SOURCE + ')(?=\\s|收|首|手|守|欠|转|钱|签|[，,。；;：:！？!?0-9零〇一二两三四五六七八九十百千万]|$)','i')
  const homophone = /^\s*(?:1|一)\s*[鸡機机季基积级个](?=\s*(?:收|首|手|守|欠|转))/i
  const isWeight = (value:string) => head.test(value) || homophone.test(value)
  // Prefer a known name/alias prefix, including contiguous numeric IDs.
  for (let i=raw.length-1;i>0;i--) {
    const name = raw.slice(0,i).replace(/[，,。；;：:\s]+$/,'')
    const tail = raw.slice(i).replace(/^[，,。；;：:\s]+/,'').replace(/^(?:那|哪|呐|纳|要)\s*/,'')
    if (name && matchCustomerAlias(name).name && isWeight(tail)) return {name,tail}
  }
  if (isWeight(raw)) return {name:'',tail:raw}
  // For unknown names, only split at a clear non-numeric boundary.
  for (let i=1;i<raw.length;i++) {
    if (/[0-9零〇一二两三四五六七八九十百千万.点]/.test(raw[i-1] ?? '')) continue
    const name = raw.slice(0,i).replace(/[，,。；;：:\s]+$/,'').replace(/(?:那|哪|呐|纳|要)$/,'')
    const tail = raw.slice(i).replace(/^[，,。；;：:\s]+/,'')
    if (name && isWeight(tail)) return {name,tail}
  }
  return undefined
}

function parseTakeSale(input: string): VoiceCommand | undefined {
  const raw = input.replace(/[０-９]/g, digit => String.fromCharCode(digit.charCodeAt(0)-65248))
    .replace(/．/g,'.').trim()
  // Preserve customer names before normalizing the transaction portion.
  const match = splitTakeSale(raw)
  if (!match) return undefined
  const spokenCustomer = shortcutCustomerName(match.name)
  const learned = matchCustomerAlias(spokenCustomer)
  const customer = learned.name ?? spokenCustomer
  const tail = normalizeText(match.tail)
    .replace(/^(1|一)[鸡機机季基积级个](?=(?:收|首|手|守|欠|转))/, '$1g')
    .replace(/(\d)点(?=\d)/g,'$1.')
    .replace(/(\d+)[点.]([零〇一二两三四五六七八九]+)/g, (_, whole: string, decimal: string) => whole + '.' + Array.from(decimal, c => CHINESE_DIGITS[c]).join(''))
    .replace(/([零〇一二两三四五六七八九十百千万]+)[点.](\d+)/g, (_, whole: string, decimal: string) => String(parseChineseInteger(whole)) + '.' + decimal)
    .replace(/[，,。；;：:！？!?](?=[收首手守欠转现实还剩钱签千牵谦前歉芡迁铅钎赊挂未没])/g, '')
    .replace(/[：:](?=[0-9零〇一二两三四五六七八九十百千万])/g,'')
    .replace(/[。！？!?]+$/,'').replace(/\.$/,'')
  let parsedWeight: number | undefined
  let paymentSpoken = false
  const error = (message: string): VoiceCommand => ({type:'sale', shortcut:true, customer, weight:parsedWeight, paymentSpoken, error:message})
  const needsCustomer = !learned.name || learned.ambiguous
  if (VAGUE_AMOUNT.test(tail)) return error('百几或一百多不是明确金额，未记账。请说具体数目，例如百五（一百五十）。')
  // 千 can be an actual numeral. Split only after an exact shortcut denomination.
  const thousandDebt = /^(.+?)千(?=[0-9零〇一二两三四五六七八九十百])/u.exec(tail)
  const beforeThousand = thousandDebt ? shortcutNumber(thousandDebt[1] ?? '') : null
  const shortcutThousand = beforeThousand !== null && QUICK_VOICE_WEIGHTS[beforeThousand] !== undefined
  const head = shortcutThousand && thousandDebt
    ? [thousandDebt[1] ?? '', thousandDebt[1] ?? '', undefined]
    : new RegExp('^(半套|' + NUMBER_SOURCE + ')(' + WEIGHT_UNIT_SOURCE + ')?', 'i').exec(tail)
  if (!head) return error('没有听清出货规格，请重新说，例如0764拿100欠30。')
  const number = head[1] === '半套' ? 300 : shortcutNumber(head[1] ?? '')
  if (number === null || !Number.isFinite(number) || number <= 0) return error('出货规格无效，请重新说。')
  const unit = head[2]
  const preset = !unit ? QUICK_VOICE_WEIGHTS[number] : undefined
  if (!unit && preset === undefined && colloquialNumber(head[1] ?? '') !== null) {
    return error('听到金额RM' + number + '，但没有对应快捷规格。请说实际重量和售价。')
  }
  // 625 is the user's shorthand for 6.25G, only in the bare weight slot.
  const weight = preset ?? (!unit && number === 625 ? 6.25 : unit ? convertWeight(number,unit) : number)
  const oneGram = preset === undefined && weight === 1
  if (weight < 0.01 || !Number.isFinite(weight)) return error('出货重量至少0.01G。')
  parsedWeight = weight
  let suffix = tail.slice((head[0] ?? '').length)
  if (preset !== undefined) suffix = suffix.replace(new RegExp('^(?:' + CURRENCY_WORDS + ')','i'),'')
  // Accept "1G 160" / "625 650" as explicit cash, but never concatenate the numbers.
  if (preset === undefined && (oneGram || weight === 6.25)) {
    const barePrice = new RegExp('^(?:[；;,，])?(' + NUMBER_SOURCE + ')(?:' + CURRENCY_WORDS + ')?$','i').exec(suffix)
    if (barePrice) suffix = '收' + (barePrice[1] ?? '')
  }
  paymentSpoken = suffix.length > 0
  const result: VoiceCommand = {type:'sale', shortcut:true, customer, weight, paymentSpoken, needsCustomer, spokenCustomer}
  // Homophones are interpreted only in a known-price shortcut payment suffix.
  const debtWords = DEBT_WORDS + (preset !== undefined || oneGram ? '|' + DEBT_HOMOPHONES : '')
  const pattern = new RegExp('^(' + CASH_WORDS + '|' + debtWords + '|' + TRANSFER_WORDS + ')(' + NUMBER_SOURCE + ')(?:' + CURRENCY_WORDS + ')?','i')
  let rest = suffix
  while (rest) {
    const p = pattern.exec(rest)
    if (!p) return error('收款或欠款没有听清，没有记账。请重说，例如0764拿100欠款30。')
    const value = shortcutNumber(p[2] ?? '')
    if (value === null || !Number.isFinite(value) || value < 0) return error('金额无效，请重新说。')
    const word = p[1] ?? ''
    const field = new RegExp('^(?:' + debtWords + ')$').test(word) ? 'debtAmount' : /^转/.test(word) ? 'transferAmount' : 'cashAmount'
    if (result[field] !== undefined) return error('同一收款项目重复，请重新说。')
    result[field] = value
    rest = rest.slice(p[0].length)
  }
  const paid = (result.cashAmount ?? 0) + (result.transferAmount ?? 0)
  if (preset !== undefined) {
    result.amount = number
    if (result.cashAmount === undefined) result.cashAmount = number - (result.transferAmount ?? 0) - (result.debtAmount ?? 0)
    else if (result.debtAmount === undefined) result.debtAmount = number - paid
    const cash = result.cashAmount ?? 0, debt = result.debtAmount ?? 0, transfer = result.transferAmount ?? 0
    if (cash < -0.00001 || debt < -0.00001 || Math.abs(cash + debt + transfer - number) > 0.005) {
      return error('收款与欠款合计不等于快捷售价，请重新说。')
    }
    result.cashAmount = Math.max(0,Math.round(cash*100)/100)
    result.debtAmount = Math.max(0,Math.round(debt*100)/100)
  } else if (oneGram && result.cashAmount === undefined && result.transferAmount === undefined) {
    // Unspecified price: 1G costs RM150. A debt-only suffix is a split of that price.
    const debt = result.debtAmount ?? 0
    if (debt > 150) return error('1G默认售价RM150，欠款超过售价，请说实际收款和欠款。')
    result.amount = 150
    result.cashAmount = Math.round((150 - debt)*100)/100
    result.debtAmount = debt
  } else if (suffix) {
    // For explicit weight sales the spoken payment determines the actual price.
    result.amount = Math.round((paid + (result.debtAmount ?? 0))*100)/100
  }
  return result
}

/** Never silently drop a payment suffix when recognition returns several candidates. */
export function selectInventoryTranscript(matches: string[]): {text:string; warning?:string} {
  const ranked = matches.map((text,index) => ({
    text:text.trim(), index, command:parseVoiceCommand(text), score:scoreCustomerTranscript(text),
  })).filter(item => item.text).sort((a,b) => b.score-a.score || a.index-b.index)
  const best = ranked[0]
  if (!best) return {text:''}
  const cmd = best.command
  if (!cmd.shortcut || cmd.error) return {text:best.text}
  const related = ranked.filter(item => item.command.shortcut &&
    item.command.weight === cmd.weight && (item.command.customer === cmd.customer || item.command.needsCustomer || cmd.needsCustomer))
  const paid = related.filter(item => !item.command.error && item.command.paymentSpoken)
  const breakdowns = new Set(paid.map(item => JSON.stringify([
    item.command.amount ?? null, item.command.cashAmount ?? 0, item.command.debtAmount ?? 0, item.command.transferAmount ?? 0,
  ])))
  if (breakdowns.size > 1 || (paid.length === 0 && related.some(item => item.command.error && item.command.paymentSpoken))) {
    return {text:best.text, warning:'收款或欠款听得不一致，未记账。请重新说完整口令，例如0764拿100欠款30。'}
  }
  const complete = paid.find(item => !item.command.needsCustomer) ?? paid[0] ?? best
  const competing = ranked.some(item => !item.command.error && item.command.shortcut && !item.command.needsCustomer && item.command.customer !== cmd.customer && !cmd.needsCustomer)
  if (competing) {
    const sameSale = ranked.filter(item => !item.command.error && item.command.shortcut && !item.command.needsCustomer)
      .every(item => item.command.weight === complete.command.weight && item.command.amount === complete.command.amount && (item.command.cashAmount ?? 0) === (complete.command.cashAmount ?? 0) && (item.command.debtAmount ?? 0) === (complete.command.debtAmount ?? 0) && (item.command.transferAmount ?? 0) === (complete.command.transferAmount ?? 0))
    const split = splitTakeSale(complete.text)
    if (sameSale && split) return {text:'拿' + split.tail}
    return {text:best.text, warning:'听到不同顾客或金额，未记账。请重新说完整口令。'}
  }
  return {text:complete.text}
}

export function parseVoiceCommand(input: string): VoiceCommand {
  const text = normalizeText(input)
  const query = detectQuery(text)

  if (query) {
    const debtCustomer = query === 'debt' ? extractDebtQueryCustomer(text) : undefined
    return {
      type: 'query',
      query,
      customer: query === 'debt'
        ? resolveKnownCustomerName(debtCustomer ?? text) ?? debtCustomer
        : undefined,
    }
  }

  const takeSale = parseTakeSale(input)
  if (takeSale) return takeSale

  const isPurchase = /进货|入货|补货|采购|买入|收货/.test(text)
  const isSale = /出货|卖给|卖予|销售|出售|卖出|售出/.test(text)
  const isIncome = /记录收入|现金收入|其他收入|收入|收款/.test(text)

  if ((isPurchase || isSale || isIncome) && VAGUE_AMOUNT.test(text)) return {type: isPurchase ? 'purchase' : isSale ? 'sale' : 'income', error:'金额不明确，未记账，请说具体数字。'}

  if (isPurchase) {
    return { type: 'purchase', ...parseActionDetails(text, 'purchase') }
  }

  if (isSale) {
    return { type: 'sale', ...parseActionDetails(text, 'sale') }
  }

  if (isIncome) {
    return { type: 'income', amount: extractNumberTokens(text)[0]?.value }
  }

  return { type: null }
}
