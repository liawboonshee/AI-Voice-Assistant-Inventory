export type PaymentMethod = 'cash' | 'transfer' | 'debt' | 'mixed' | 'none'

export type PaymentBreakdown = {
  total: number
  cashAmount: number
  transferAmount: number
  debtAmount: number
  paidAmount: number
  paymentMethod: PaymentMethod
}

export type PaymentInput = {
  total?: number
  cashAmount?: number
  transferAmount?: number
  debtAmount?: number
}

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function checkedAmount(value: number | undefined): number | null {
  if (value === undefined) return 0
  if (!Number.isFinite(value) || value < 0) return null
  return round(value)
}

export function calculatePaymentBreakdown(input: PaymentInput): PaymentBreakdown | string {
  const cash = checkedAmount(input.cashAmount)
  const transfer = checkedAmount(input.transferAmount)
  const enteredDebt = checkedAmount(input.debtAmount)
  if (cash === null || transfer === null || enteredDebt === null) return '收款和欠款不能小于0'

  const hasSplit =
    input.cashAmount !== undefined ||
    input.transferAmount !== undefined ||
    input.debtAmount !== undefined

  let total = input.total === undefined ? undefined : checkedAmount(input.total)
  if (total === null) return '总售价不能小于0'

  if (total === undefined) total = round(cash + transfer + enteredDebt)
  if (!hasSplit && total > 0) {
    return {
      total,
      cashAmount: total,
      transferAmount: 0,
      debtAmount: 0,
      paidAmount: total,
      paymentMethod: 'cash',
    }
  }

  let debt = enteredDebt
  const splitTotal = round(cash + transfer + debt)
  if (input.debtAmount === undefined && total > splitTotal) {
    debt = round(total - cash - transfer)
  }

  if (round(cash + transfer + debt) !== total) {
    return `现金、转账和欠款合计必须等于总售价RM${total.toFixed(2)}`
  }

  const paidAmount = round(cash + transfer)
  const active = [cash > 0, transfer > 0, debt > 0].filter(Boolean).length
  const paymentMethod: PaymentMethod =
    total <= 0
      ? 'none'
      : active > 1
        ? 'mixed'
        : cash > 0
          ? 'cash'
          : transfer > 0
            ? 'transfer'
            : 'debt'

  return {
    total,
    cashAmount: cash,
    transferAmount: transfer,
    debtAmount: debt,
    paidAmount,
    paymentMethod,
  }
}

export function paymentSummary(payment: PaymentBreakdown): string {
  if (payment.paymentMethod === 'none') return '未填写金额'
  return [
    payment.cashAmount > 0 ? `现金RM${payment.cashAmount.toFixed(2)}` : '',
    payment.transferAmount > 0 ? `转账RM${payment.transferAmount.toFixed(2)}` : '',
    payment.debtAmount > 0 ? `欠款RM${payment.debtAmount.toFixed(2)}` : '',
  ].filter(Boolean).join('、')
}
