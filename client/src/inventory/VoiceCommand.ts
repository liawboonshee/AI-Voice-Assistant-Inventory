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
  String.raw`(?:\d+(?:,\d{3})*(?:\.\d+)?|[零〇一二两三四五六七八九十百千万]+(?:点[零〇一二两三四五六七八九]+)?|半)`

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

export function parseSpokenNumber(raw: string): number | null {
  const text = raw.trim().replace(/，/g, ',')
  if (!text) return null
  if (text === '半') return 0.5

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
  return extractNumberTokens(normalizeText(text))[0]?.value ?? null
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
  const embedded = names.find((name) => normalizedInput.includes(normalizeText(name)))
  if (embedded) return embedded

  const candidate = cleanCustomerCandidate(
    extractCustomer(normalizedInput) ?? extractDebtQueryCustomer(normalizedInput) ?? normalizedInput,
  )
  if (!candidate) return undefined

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

  const isPurchase = /进货|入货|补货|采购|买入|收货/.test(text)
  const isSale = /出货|卖给|卖予|销售|出售|卖出|售出/.test(text)
  const isIncome = /记录收入|现金收入|其他收入|收入|收款/.test(text)

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
