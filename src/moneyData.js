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
  const emi = entry.emiId
    ? emis.find((item) => item.id === entry.emiId)
    : emis.find((item) => item.name === entry.name)
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
  }
}

export function toCardRow(card, userId) {
  return {
    id: card.id,
    user_id: userId,
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

export function toEmiRow(emi, userId) {
  return {
    id: emi.id,
    user_id: userId,
    name: emi.name,
    monthly_emi: Number(emi.amount),
    due_day: Number(emi.dueDay),
    start_date: emi.startDate || null,
  }
}

export function fromEmiRow(row) {
  return {
    id: row.id,
    name: row.name,
    amount: Number(row.monthly_emi),
    dueDay: String(row.due_day),
    startDate: row.start_date || '',
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
