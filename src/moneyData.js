const sourceToDatabase = {
  'UPI spent': 'upi',
  'Cash spent': 'cash',
  'Credit card payment': 'credit_card',
  'Card repayment': 'card_repayment',
  'EMI payment': 'emi',
  'Other spending': 'other',
}

const sourceFromDatabase = Object.fromEntries(
  Object.entries(sourceToDatabase).map(([label, value]) => [value, label]),
)

export function toMoneyEntryRow(entry, cards, emis, userId) {
  const card = entry.cardId
    ? cards.find((item) => item.id === entry.cardId)
    : cards.find((item) => item.name === entry.cardName)
  const emi = entry.category === 'EMI payment'
    ? entry.emiId
      ? emis.find((item) => item.id === entry.emiId)
      : emis.find((item) => item.name === entry.name)
    : undefined
  const paymentSource = entry.type === 'Income'
    ? 'other_income'
    : sourceToDatabase[entry.category] || 'other'
  const entryType = entry.type === 'Income'
    ? 'income'
    : entry.category === 'EMI payment'
      ? 'emi_payment'
      : entry.category === 'Card repayment'
        ? 'card_repayment'
        : 'spending'

  return {
    id: entry.id,
    user_id: userId,
    entry_type: entryType,
    description: entry.name,
    reason: entry.reason || null,
    payment_source: paymentSource,
    amount: entry.amount,
    entry_date: entry.date,
    card_id: card?.id || null,
    emi_id: emi?.id || null,
    holding_id: entry.holdingId || null,
  }
}

export function fromMoneyEntryRow(row, cards) {
  const linkedCard = cards.find((card) => card.id === row.card_id)
  const category = sourceFromDatabase[row.payment_source] || ''

  return {
    id: row.id,
    name: row.description,
    reason: row.reason || '',
    amount: Number(row.amount),
    date: row.entry_date,
    type: row.entry_type === 'income' ? 'Income' : 'Spending',
    category,
    cardName: linkedCard?.name || '',
    cardId: row.card_id || '',
    emiId: row.emi_id || '',
    holdingId: row.holding_id || '',
  }
}

export function toCardRow(card, userId) {
  return {
    id: card.id,
    user_id: userId,
    record_type: 'card',
    name: card.name,
    due_day: card.dueDay ? Number(card.dueDay) : null,
    opening_balance: Number(card.amount) || 0,
  }
}

export function fromCardRow(row) {
  return {
    id: row.id,
    name: row.name,
    amount: Number(row.opening_balance) || 0,
    dueDay: row.due_day ? String(row.due_day) : '',
  }
}

export function toChitFundRow(chitFund, userId) {
  return {
    id: chitFund.id,
    user_id: userId,
    record_type: 'chit_fund',
    name: chitFund.name,
    due_day: null,
    opening_balance: 0,
    monthly_amount: Number(chitFund.monthlyAmount),
    start_date: chitFund.startDate,
    end_date: chitFund.endDate,
    paid_months: chitFund.paidMonths,
  }
}

export function fromChitFundRow(row) {
  return {
    id: row.id,
    name: row.name,
    monthlyAmount: Number(row.monthly_amount),
    startDate: row.start_date,
    endDate: row.end_date,
    paidMonths: Array.isArray(row.paid_months)
      ? row.paid_months.filter((payment) => (
        payment && typeof payment.month === 'string' && /^\d{4}-\d{2}$/.test(payment.month)
      )).map((payment) => ({
        month: payment.month,
        transactionId: typeof payment.transactionId === 'string' ? payment.transactionId : '',
        moneyEntryId: typeof payment.moneyEntryId === 'string' ? payment.moneyEntryId : '',
      }))
      : [],
  }
}

export function toEmiRow(emi, userId) {
  return {
    id: emi.id,
    user_id: userId,
    name: emi.name,
    monthly_emi: Number(emi.amount),
    due_day: Number(emi.dueDay),
    start_date: emi.startDate || null,
    end_date: emi.endDate || null,
    is_completed: Boolean(emi.isCompleted),
  }
}

export function fromEmiRow(row) {
  return {
    id: row.id,
    name: row.name,
    amount: Number(row.monthly_emi),
    dueDay: String(row.due_day),
    startDate: row.start_date || '',
    endDate: row.end_date || '',
    isCompleted: row.is_completed === true,
  }
}

export function cardBalanceFromEntries(card, entries) {
  return entries.reduce((balance, entry) => {
    if (entry.card_id !== card.id) return balance
    if (entry.payment_source === 'credit_card') return balance + Number(entry.amount)
    if (entry.payment_source === 'card_repayment') return Math.max(0, balance - Number(entry.amount))
    return balance
  }, Number(card.opening_balance) || 0)
}
