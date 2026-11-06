function text(value, maxLength = 180) {
  return typeof value === 'string' ? value.slice(0, maxLength) : ''
}

function amount(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function recentItems(items, limit) {
  return items.slice(0, limit)
}

function summarizeMoney(data, monthKey, includeHistory) {
  const transactions = Array.isArray(data.transactions) ? data.transactions : []
  const monthlyTotals = transactions.reduce((totals, entry) => {
    const month = entry.date?.slice(0, 7)
    if (!month) return totals
    totals[month] = totals[month] || { income: 0, spending: 0, entries: 0 }
    totals[month].entries += 1
    if (entry.type === 'Income') totals[month].income += amount(entry.amount)
    else totals[month].spending += amount(entry.amount)
    return totals
  }, {})
  const monthEntries = transactions.filter((entry) => entry.date?.slice(0, 7) === monthKey)
  const categoryTotals = monthEntries.reduce((totals, entry) => {
    if (entry.type === 'Income') return totals
    const category = text(entry.category, 80) || 'Other spending'
    totals[category] = (totals[category] || 0) + amount(entry.amount)
    return totals
  }, {})

  return {
    selectedMonth: monthKey,
    monthlyBudget: amount(data.monthlyBudgets?.[monthKey]),
    totalsByMonth: Object.fromEntries(
      Object.entries(monthlyTotals).sort(([first], [second]) => second.localeCompare(first)).slice(0, 12),
    ),
    selectedMonthCategoryTotals: categoryTotals,
    selectedMonthEntryCount: monthEntries.length,
    selectedMonthEntries: recentItems(monthEntries, 60).map((entry) => ({
      date: text(entry.date, 20),
      name: text(entry.name, 120),
      reason: text(entry.reason, 80),
      type: text(entry.type, 30),
      category: text(entry.category, 60),
      amount: amount(entry.amount),
      card: text(entry.cardName, 60),
    })),
    recentEntries: includeHistory ? recentItems(
      [...transactions]
        .filter((entry) => entry.date?.slice(0, 7) !== monthKey)
        .sort((first, second) => (second.date || '').localeCompare(first.date || '')),
      20,
    ).map((entry) => ({
      date: text(entry.date, 20),
      name: text(entry.name, 120),
      reason: text(entry.reason, 80),
      type: text(entry.type, 30),
      category: text(entry.category, 60),
      amount: amount(entry.amount),
      card: text(entry.cardName, 60),
    })) : [],
    cards: recentItems(data.cards || [], 20).map((card) => ({
      name: text(card.name, 80),
      openingBalance: amount(card.amount),
      dueDay: text(card.dueDay, 10),
    })),
    emis: recentItems(data.emis || [], 20).map((emi) => ({
      name: text(emi.name, 100),
      monthlyAmount: amount(emi.amount),
      dueDay: text(emi.dueDay, 10),
      startDate: text(emi.startDate, 20),
      endDate: text(emi.endDate, 20),
      completed: Boolean(emi.isCompleted),
      payments: recentItems(emi.monthlyPayments || [], 12).map((payment) => ({
        month: text(payment.month, 10),
        amount: amount(payment.amount),
      })),
    })),
    holdings: recentItems(data.holdings || [], 20).map((holding) => ({
      name: text(holding.name, 100),
      frequency: text(holding.sip_frequency, 20),
      dailySip: amount(holding.daily_sip),
      monthlySip: amount(holding.monthly_sip),
      currentValue: amount(holding.current_value),
    })),
    subscriptions: recentItems(data.subscriptions || [], 20).map((subscription) => ({
      name: text(subscription.name, 100),
      amount: amount(subscription.amount),
      startDate: text(subscription.start_date, 20),
      endDate: text(subscription.end_date, 20),
    })),
    chitFunds: recentItems(data.chitFunds || [], 20).map((fund) => ({
      name: text(fund.name, 100),
      monthlyAmount: amount(fund.monthlyAmount),
      startDate: text(fund.startDate, 20),
      endDate: text(fund.endDate, 20),
      paidMonths: recentItems(fund.paidMonths || [], 60).map((payment) => text(payment.month, 10)),
    })),
    detailNote: monthEntries.length > 60
      ? `Detailed rows are limited to the latest 60 of ${monthEntries.length}; monthly totals and category totals use all entries.`
      : '',
  }
}

function summarizeTrips(trips) {
  return recentItems(trips || [], 30).map((trip) => ({
    title: text(trip.title, 100),
    date: text(trip.trip_date, 100),
    notes: text(trip.notes, 300),
    expenses: recentItems(Array.isArray(trip.trip_expenses) ? trip.trip_expenses : [], 100).map((expense) => ({
      description: text(expense.description, 100),
      date: text(expense.date, 20),
      amount: amount(expense.amount),
    })),
    bookings: recentItems(Array.isArray(trip.booking_details) ? trip.booking_details : [], 20).map((booking) => ({
      title: text(booking.title, 100),
      notes: text(booking.notes, 300),
    })),
  }))
}

export function buildAiContext(mode, data, monthKey) {
  const trips = summarizeTrips(data.trips)

  if (mode === 'trips') return { trips }
  const money = summarizeMoney(data, monthKey, mode === 'chat')
  if (mode === 'money') return { money }

  return {
    month: monthKey,
    money,
    trips,
    careerGoals: recentItems((data.goals || []).filter((goal) => goal.category === 'Career & skills'), 30).map((goal) => ({
      title: text(goal.title, 150),
      detail: text(goal.detail, 250),
      progress: amount(goal.progress),
      total: amount(goal.total),
    })),
    personalGoals: recentItems((data.goals || []).filter((goal) => goal.category !== 'Career & skills'), 30).map((goal) => ({
      title: text(goal.title, 150),
      detail: text(goal.detail, 250),
      progress: amount(goal.progress),
      total: amount(goal.total),
    })),
    businessIdeas: recentItems(data.ideas || [], 30).map((idea) => ({
      title: text(idea.title, 120),
      category: text(idea.category, 80),
      note: text(idea.note, 250),
      stage: text(idea.stage, 50),
    })),
    businessResearchNotes: recentItems((data.workspaceNotes || []).filter((note) => note.type === 'business'), 30).map((note) => ({
      idea: text(note.title, 120),
      content: text(note.content, 1800),
      updatedAt: text(note.updatedAt, 30),
    })),
    personalLifeNotes: recentItems((data.workspaceNotes || []).filter((note) => note.type === 'personal'), 30).map((note) => ({
      goal: text(note.title, 120),
      content: text(note.content, 1800),
      updatedAt: text(note.updatedAt, 30),
    })),
    careerTopics: recentItems(data.careerTopics || [], 40).map((topic) => ({
      goal: text(topic.goal_title, 120),
      title: text(topic.title, 120),
      parent: text(data.careerTopics.find((parent) => parent.id === topic.parent_id)?.title, 120),
      notes: text(topic.notes, 600),
    })),
    careerTopicsNote: (data.careerTopics || []).length > 40
      ? `Career topic details are limited to the first 40 of ${data.careerTopics.length} saved topics.`
      : '',
    occasions: recentItems(data.occasions || [], 30).map((occasion) => ({
      person: text(occasion.person_name, 100),
      type: text(occasion.occasion_type, 60),
      date: text(occasion.occasion_date, 20),
      relationship: text(occasion.relationship, 100),
      giftIdeas: text(occasion.gift_ideas, 250),
      plans: text(occasion.plans, 250),
    })),
    recipes: recentItems(data.recipes || [], 30).map((recipe) => ({
      title: text(recipe.title, 150),
      category: text(recipe.category, 80),
      ingredients: text(recipe.ingredients, 250),
      instructions: text(recipe.instructions, 300),
      notes: text(recipe.notes, 200),
    })),
    completedHabitDays: amount(data.completedDays?.length),
    detailNote: 'Lists and detailed transaction rows are capped for request size. Important documents, files, attachments, images, and storage paths are never included.',
  }
}
