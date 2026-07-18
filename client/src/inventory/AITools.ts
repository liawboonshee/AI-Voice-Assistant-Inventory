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
  type VoiceCommand,
} from './VoiceCommand'

let pendingCommand: VoiceCommand | null = null

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
    next.customer = cleanCustomerReply(text)
    return next
  }

  const number = extractFirstSpokenNumber(text)
  if (number === null) return next

  if (missing === 'weight') next.weight = number
  if (missing === 'amount') next.amount = number
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
