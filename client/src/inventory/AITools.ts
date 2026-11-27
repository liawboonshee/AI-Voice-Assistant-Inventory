import { askInventory } from './InventoryAI'
import {
  executeParsedVoiceCommand,
  getMissingCommandField,
  getMissingCommandPrompt,
} from './VoiceAction'
import {
  extractFirstSpokenNumber,
  parseVoiceCommand,
  resolveKnownCustomerName,
  matchCustomerAlias,
  normalizeCustomerAlias,
  type VoiceCommand,
} from './VoiceCommand'

let pendingCommand: VoiceCommand | null = null

export function getPendingCustomerCommand(): VoiceCommand | null {
  return pendingCommand?.needsCustomer && getMissingCommandField(pendingCommand) === 'customer'
    ? {...pendingCommand} : null
}

export function cancelPendingVoiceCommand(): void { pendingCommand = null }

export function confirmPendingCustomer(name: string, remember = false): string {
  const command = getPendingCustomerCommand()
  if (!command) return '没有待确认的交易。'
  try {
    const list = JSON.parse(localStorage.getItem('customers') || '[]')
    if (!Array.isArray(list) || list.filter(item => item.name === name).length !== 1) return '顾客不存在或名称重复，请重新选择。'
  } catch { return '顾客资料无法读取。' }
  pendingCommand = null
  const result = executeParsedVoiceCommand({...command, customer:name, needsCustomer:false}) || '未能保存交易。'
  if (remember && result.startsWith('✅') && command.spokenCustomer) {
    try {
      const alias = command.spokenCustomer
      const key = normalizeCustomerAlias(alias)
      const list = JSON.parse(localStorage.getItem('customers') || '[]')
      const customer = Array.isArray(list) ? list.find(item => item.name === name) : undefined
      const conflict = matchCustomerAlias(alias)
      if (customer && key && key.length <= 80 && !conflict.name && !conflict.ambiguous) {
        const aliases = Array.isArray(customer.voiceAliases) ? customer.voiceAliases : []
        if (aliases.length < 10 && !aliases.some((item: string) => normalizeCustomerAlias(item) === key)) {
          customer.voiceAliases = [...aliases,alias]
          localStorage.setItem('customers',JSON.stringify(list))
          return result + ' 已记住这次顾客叫法。'
        }
      }
    } catch { return result + ' 发音未保存。' }
  }
  return result
}

function cleanCustomerReply(text: string): string | undefined {
  const name = text
    .trim()
    .replace(/[，,。；;!?！？]/g, '')
    .replace(/^(客户|顾客)(是|叫|为)?/, '')
    .replace(/^(是|叫)/, '')
    .trim()
  return (name && resolveKnownCustomerName(name)) || name || undefined
}

function mergeFollowUp(command: VoiceCommand, text: string): VoiceCommand {
  const next = { ...command }
  const missing = getMissingCommandField(next)

  if (missing === 'customer') {
    if (next.needsCustomer) {
      const exact = matchCustomerAlias(text.trim())
      if (exact.name && !exact.ambiguous) { next.customer = exact.name; next.needsCustomer = false }
      else next.spokenCustomer = text.trim()
    } else next.customer = cleanCustomerReply(text)
    return next
  }

  const number = extractFirstSpokenNumber(text)
  if (number === null) return next

  if (missing === 'weight') next.weight = number
  if (missing === 'amount') {
    next.amount = number
    if (next.shortcut) {
      if (/欠/.test(text)) next.debtAmount = number
      else if (/转账|转帐/.test(text)) next.transferAmount = number
      else next.cashAmount = number
    }
  }
  return next
}

export function runInventoryTool(input: string): string | null {
  const text = input.trim()
  if (!text) return null

  if (/^(取消|不要了|算了|重来|清除)$/.test(text)) {
    if (!pendingCommand) return null
    pendingCommand = null
    return '已取消刚才那笔库存操作。'
  }

  const command = parseVoiceCommand(text)

  if (command.error) {
    pendingCommand = null
    return command.error
  }

  if (command.type === 'query') {
    pendingCommand = null
    return askInventory(text)
  }

  if (command.type === 'sale' || command.type === 'purchase' || command.type === 'income') {
    pendingCommand = command
  } else if (pendingCommand) {
    pendingCommand = mergeFollowUp(pendingCommand, text)
  } else {
    return null
  }

  const activeCommand = pendingCommand
  if (!activeCommand) return null

  const prompt = getMissingCommandPrompt(activeCommand)
  if (prompt) return prompt

  const answer = executeParsedVoiceCommand(activeCommand)
  pendingCommand = null
  return answer
}
