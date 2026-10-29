import { useEffect, useMemo, useRef, useState } from 'react'
import { fromCardRow, fromChitFundRow, fromEmiRow, fromMoneyEntryRow, toCardRow, toChitFundRow, toEmiRow, toMoneyEntryRow } from './moneyData'
import { supabase, supabaseConfigured } from './supabase'
import './App.css'

const appDate = new Date()
const monthNames = Array.from({ length: 12 }, (_, index) => new Date(2026, index, 1).toLocaleDateString('en-IN', { month: 'long' }))
const paymentSources = ['UPI spent', 'Cash spent', 'Credit card payment', 'Card repayment', 'EMI payment', 'Other spending']
const businessImageBucket = 'business-exploration-images'
const tripMediaBucket = 'trip-memories'
const maxTripPhotoSize = 10 * 1024 * 1024
const maxTripVideoSize = 50 * 1024 * 1024
const maxTripMedia = 30
const tripMediaTypes = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
}
const noteTableByType = {
  business: { table: 'business_exploration_notes', idColumn: 'idea_id', titleColumn: 'idea_title', pathPrefix: '' },
  personal: { table: 'personal_life_notes', idColumn: 'goal_id', titleColumn: 'goal_title', pathPrefix: 'personal-life/' },
}
const maxBusinessImageSize = 5 * 1024 * 1024
const maxBusinessImages = 8

const initialIdeas = [
  { id: 'clothing-industry', title: 'Clothing industry', category: 'Business exploration', note: 'Explore customer, product, sourcing, startup cost, and sales channel.', color: 'peach', stage: 'To explore', icon: 'spark' },
  { id: 'pg-paying-guest', title: 'PG (paying guest)', category: 'Business exploration', note: 'Research locations, occupancy, rent, setup costs, and local requirements.', color: 'mint', stage: 'To explore', icon: 'globe' },
  { id: 'event-management', title: 'Event management', category: 'Business exploration', note: 'Explore event types, client demand, packages, and how to get first clients.', color: 'lavender', stage: 'To explore', icon: 'heart' },
  { id: 'water-bottle-business', title: 'Water bottle business', category: 'Business exploration', note: 'Research product options, manufacturing, differentiation, and margins.', color: 'mint', stage: 'To explore', icon: 'leaf' },
  { id: 'dairy-farming', title: 'Dairy farming', category: 'Business exploration', note: 'Explore livestock, feed and care, setup costs, milk demand, and local requirements.', color: 'mint', stage: 'To explore', icon: 'leaf' },
]

const initialGoals = [
  { title: 'Learn DSA, Java, C#, system design & cloud', detail: 'Career & skills · Choose a topic and log a study session.', progress: 0, total: 5, color: 'green', category: 'Career & skills' },
  { title: 'Learn through Crackify courses', detail: 'Career & skills · Work through your enrolled Crackify courses and track each learning milestone.', progress: 0, total: 5, color: 'purple', category: 'Career & skills' },
  { title: 'Improve English speaking & communication', detail: 'Career & skills · Practise speaking, listening, and expressing ideas.', progress: 0, total: 5, color: 'orange', category: 'Career & skills' },
  { title: 'Home remodeling', detail: 'Personal & life · Plan ideas, priorities, and budget.', progress: 0, total: 4, color: 'purple', category: 'Personal & life' },
  { title: 'Marriage', detail: 'Personal & life · Keep plans, conversations, and next steps together.', progress: 0, total: 4, color: 'green', category: 'Personal & life' },
]

const navItems = [
  { id: 'Overview', icon: 'grid' },
  { id: 'Career & skills', icon: 'book' },
  { id: 'Personal & life', icon: 'heart' },
  { id: 'Business exploration', icon: 'lightbulb', count: 'ideas' },
  { id: 'Money', icon: 'wallet' },
  { id: 'Journal', icon: 'journal' },
  { id: 'Habits', icon: 'habits' },
]

function usePersistentState(key, initialValue) {
  const [value, setValue] = useState(() => {
    const saved = window.localStorage.getItem(key)
    if (saved === null) return initialValue

    const parsed = JSON.parse(saved)
    if (!['daymark-ideas', 'daymark-goals'].includes(key) || !Array.isArray(parsed)) return parsed

    const savedItems = key === 'daymark-ideas'
      ? parsed.map((item) => ({ ...item, id: item.id || window.crypto.randomUUID() }))
      : parsed
    const existingTitles = new Set(savedItems.map((item) => item.title))
    const newItems = initialValue.filter((item) => !existingTitles.has(item.title))
    return [...savedItems, ...newItems]
  })

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])

  return [value, setValue]
}

function dateInputValue(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getMonthsInRange(startDate, endDate) {
  if (!startDate || !endDate || endDate < startDate) return []

  const [startYear, startMonth] = startDate.slice(0, 7).split('-').map(Number)
  const [endYear, endMonth] = endDate.slice(0, 7).split('-').map(Number)
  const totalMonths = (endYear - startYear) * 12 + endMonth - startMonth + 1
  if (!Number.isInteger(totalMonths) || totalMonths < 1) return []

  return Array.from({ length: totalMonths }, (_, index) => {
    const date = new Date(startYear, startMonth - 1 + index, 1)
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
    }
  })
}

function getLoginStreak(activityDates, today) {
  const dateSet = new Set(activityDates)
  const yesterday = new Date(`${today}T00:00:00`)
  yesterday.setDate(yesterday.getDate() - 1)
  let currentDate = dateSet.has(today) ? today : dateInputValue(yesterday)
  if (!dateSet.has(currentDate)) return 0

  let streak = 0
  while (dateSet.has(currentDate)) {
    streak += 1
    const previousDate = new Date(`${currentDate}T00:00:00`)
    previousDate.setDate(previousDate.getDate() - 1)
    currentDate = dateInputValue(previousDate)
  }
  return streak
}

function getDueTomorrowNotifications(emis, cards, today) {
  const tomorrow = new Date(`${today}T00:00:00`)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const lastDayOfMonth = new Date(tomorrow.getFullYear(), tomorrow.getMonth() + 1, 0).getDate()
  const tomorrowDay = tomorrow.getDate()
  const dueTomorrow = (item) => Number(item.dueDay) > 0
    && Math.min(Number(item.dueDay), lastDayOfMonth) === tomorrowDay

  return [
    ...emis.filter((emi) => !emi.isCompleted && dueTomorrow(emi)).map((emi) => ({
      id: `emi-${emi.id}`,
      title: `${emi.name} EMI is due tomorrow`,
      detail: `Monthly payment · ${formatMoney(Number(emi.amount))}`,
      type: 'EMI',
    })),
    ...cards.filter(dueTomorrow).map((card) => ({
      id: `card-${card.id}`,
      title: `${card.name} payment is due tomorrow`,
      detail: `Credit card · Due day ${card.dueDay}`,
      type: 'Card',
    })),
  ]
}

const iconPaths = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  lightbulb: <><path d="M9 18h6M10 22h4M8.2 14.5A7 7 0 1 1 15.8 14.5c-.9.7-1.3 1.5-1.4 2.5h-5c-.1-1-.5-1.8-1.2-2.5Z" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  journal: <><path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H20v18H7.5A2.5 2.5 0 0 1 5 17.5z" /><path d="M5 17.5A2.5 2.5 0 0 1 7.5 15H20M9 7h7M9 10h7" /></>,
  habits: <><path d="M20 7 10 17l-5-5" /><path d="M20 12v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  chevron: <path d="m9 18 6-6-6-6" />,
  leaf: <><path d="M20 4c-8 0-14 3-14 10a6 6 0 0 0 6 6c7 0 10-6 8-16Z" /><path d="M4 21c3-5 7-8 13-11" /></>,
  spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2L12 3Z" /><path d="m19 14 1 2.5 2.5 1-2.5 1L19 21l-1-2.5-2.5-1 2.5-1L19 14Z" /></>,
  heart: <path d="M20.8 8.7c0 4.1-8.8 10-8.8 10s-8.8-5.9-8.8-10A4.7 4.7 0 0 1 12 6.2a4.7 4.7 0 0 1 8.8 2.5Z" />,
  chat: <><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
  book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  close: <><path d="m18 6-12 12M6 6l12 12" /></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  wallet: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M3 9h18M16 15h.01M7 5V3h11" /></>,
  card: <><rect x="2.5" y="4.5" width="19" height="15" rx="2" /><path d="M2.5 9.5h19M6.5 15h4" /></>,
  receipt: <><path d="M4 3v18l4-2 4 2 4-2 4 2V3l-4 2-4-2-4 2-4-2Z" /><path d="M9 10h6M9 14h6" /></>,
  income: <><path d="M12 19V5M6 11l6-6 6 6" /></>,
  expense: <><path d="M12 5v14M18 13l-6 6-6-6" /></>,
  maximize: <><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3" /></>,
  minimize: <><path d="M8 3v5H3M16 3v5h5M21 16h-5v5M3 16h5v5" /></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
  trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" /></>,
  edit: <><path d="m15 5 4 4M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16l-1 4Z" /></>,
}

function Icon({ name, size = 18, className = '' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {iconPaths[name]}
    </svg>
  )
}

function App() {
  const [activePage, setActivePage] = useState('Overview')
  const [ideas, setIdeas] = usePersistentState('daymark-ideas', initialIdeas)
  const [goals] = usePersistentState('daymark-goals', initialGoals)
  const [selectedCareerGoal, setSelectedCareerGoal] = useState('')
  const [careerTopics, setCareerTopics] = useState([])
  const [careerTopicsLoading, setCareerTopicsLoading] = useState(false)
  const [careerTopicsError, setCareerTopicsError] = useState('')
  const [careerTopicsReload, setCareerTopicsReload] = useState(0)
  const [selectedCareerTopicId, setSelectedCareerTopicId] = useState('')
  const [careerTopicNotes, setCareerTopicNotes] = useState('')
  const [newCareerTopicTitle, setNewCareerTopicTitle] = useState('')
  const [careerTopicSaving, setCareerTopicSaving] = useState(false)
  const [transactions, setTransactions] = useState([])
  const [emis, setEmis] = useState([])
  const [cards, setCards] = useState([])
  const [chitFunds, setChitFunds] = useState([])
  const [chitFundName, setChitFundName] = useState('')
  const [chitFundMonthlyAmount, setChitFundMonthlyAmount] = useState('')
  const [chitFundStartDate, setChitFundStartDate] = useState('')
  const [chitFundEndDate, setChitFundEndDate] = useState('')
  const [chitFundFormOpen, setChitFundFormOpen] = useState(false)
  const [editingChitFundId, setEditingChitFundId] = useState(null)
  const [chitFundError, setChitFundError] = useState('')
  const [chitTransactionIds, setChitTransactionIds] = useState({})
  const [availableCards, setAvailableCards] = useState([])
  const [holdings, setHoldings] = useState([])
  const [holdingName, setHoldingName] = useState('')
  const [holdingFrequency, setHoldingFrequency] = useState('monthly')
  const [holdingSipAmount, setHoldingSipAmount] = useState('')
  const [holdingCurrentValue, setHoldingCurrentValue] = useState('')
  const [holdingFormOpen, setHoldingFormOpen] = useState(false)
  const [editingHoldingId, setEditingHoldingId] = useState(null)
  const [holdingError, setHoldingError] = useState('')
  const [holdingPaymentFormId, setHoldingPaymentFormId] = useState(null)
  const [holdingPaymentFormMonth, setHoldingPaymentFormMonth] = useState('')
  const [holdingPaymentAmount, setHoldingPaymentAmount] = useState('')
  const [subscriptions, setSubscriptions] = useState([])
  const [subscriptionName, setSubscriptionName] = useState('')
  const [subscriptionAmount, setSubscriptionAmount] = useState('')
  const [subscriptionStartDate, setSubscriptionStartDate] = useState('')
  const [subscriptionEndDate, setSubscriptionEndDate] = useState('')
  const [editingSubscriptionId, setEditingSubscriptionId] = useState(null)
  const [subscriptionFormOpen, setSubscriptionFormOpen] = useState(false)
  const [subscriptionError, setSubscriptionError] = useState('')
  const [completedDays, setCompletedDays] = usePersistentState('daymark-habits', [])
  const [selectedYear, setSelectedYear] = useState(appDate.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [moneyModalOpen, setMoneyModalOpen] = useState(false)
  const [moneyModalType, setMoneyModalType] = useState('transaction')
  const [editingTransactionId, setEditingTransactionId] = useState(null)
  const [editingCommitmentId, setEditingCommitmentId] = useState(null)
  const [emiCompleted, setEmiCompleted] = useState(false)
  const [emiEndDate, setEmiEndDate] = useState('')
  const [session, setSession] = useState(null)
  const [loginStreak, setLoginStreak] = useState(null)
  const [streakError, setStreakError] = useState('')
  const [notificationDate, setNotificationDate] = useState(dateInputValue(appDate))
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [authLoading, setAuthLoading] = useState(supabaseConfigured)
  const [cloudLoading, setCloudLoading] = useState(false)
  const [cloudLoadedKey, setCloudLoadedKey] = useState('')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authMode, setAuthMode] = useState('signin')
  const [cloudError, setCloudError] = useState('')
  const [cloudLoadError, setCloudLoadError] = useState('')
  const [cloudNotice, setCloudNotice] = useState('')
  const [realtimeStatus, setRealtimeStatus] = useState('disconnected')
  const [localFinanceBackupAvailable] = useState(() => {
    if (window.localStorage.getItem('daymark-pre-supabase-finance-v1')) return true
    return ['daymark-transactions', 'daymark-emis', 'daymark-cards'].some((key) => (
      JSON.parse(window.localStorage.getItem(key) || '[]').length > 0
    ))
  })
  const [cloudRefreshCount, setCloudRefreshCount] = useState(0)
  const [ideaTitle, setIdeaTitle] = useState('')
  const [ideaNote, setIdeaNote] = useState('')
  const [selectedIdea, setSelectedIdea] = useState(null)
  const [selectedNoteType, setSelectedNoteType] = useState('business')
  const [businessNote, setBusinessNote] = useState('')
  const [businessNoteImagePaths, setBusinessNoteImagePaths] = useState([])
  const [businessNoteInitialImagePaths, setBusinessNoteInitialImagePaths] = useState([])
  const [businessNoteImages, setBusinessNoteImages] = useState([])
  const [businessNoteFiles, setBusinessNoteFiles] = useState([])
  const [businessNoteLoading, setBusinessNoteLoading] = useState(false)
  const [businessNoteSaving, setBusinessNoteSaving] = useState(false)
  const [businessNoteLoadError, setBusinessNoteLoadError] = useState('')
  const [businessNoteError, setBusinessNoteError] = useState('')
  const [businessImageError, setBusinessImageError] = useState('')
  const [businessNoteReload, setBusinessNoteReload] = useState(0)
  const [deletingIdeaIds, setDeletingIdeaIds] = useState([])
  const [personalView, setPersonalView] = useState('goals')
  const [trips, setTrips] = useState([])
  const [tripsLoading, setTripsLoading] = useState(false)
  const [tripsLoaded, setTripsLoaded] = useState(false)
  const [tripsError, setTripsError] = useState('')
  const [tripsReload, setTripsReload] = useState(0)
  const [deletingTripIds, setDeletingTripIds] = useState([])
  const [addTripOpen, setAddTripOpen] = useState(false)
  const [newTripTitle, setNewTripTitle] = useState('')
  const [newTripDate, setNewTripDate] = useState('')
  const [tripSaving, setTripSaving] = useState(false)
  const [selectedTrip, setSelectedTrip] = useState(null)
  const [tripTitle, setTripTitle] = useState('')
  const [tripDate, setTripDate] = useState('')
  const [tripNotes, setTripNotes] = useState('')
  const [tripMediaPaths, setTripMediaPaths] = useState([])
  const [tripMediaFiles, setTripMediaFiles] = useState([])
  const [tripSignedMedia, setTripSignedMedia] = useState([])
  const [tripMediaLoading, setTripMediaLoading] = useState(false)
  const [tripMediaError, setTripMediaError] = useState('')
  const [tripMediaReload, setTripMediaReload] = useState(0)
  const [tripCarouselIndex, setTripCarouselIndex] = useState(0)
  const [tripCarouselExpanded, setTripCarouselExpanded] = useState(false)
  const [entryType, setEntryType] = useState('Spending')
  const [entryName, setEntryName] = useState('')
  const [entryReason, setEntryReason] = useState('')
  const [entryAmount, setEntryAmount] = useState('')
  const [entryDate, setEntryDate] = useState(appDate.toISOString().slice(0, 10))
  const [entryCategory, setEntryCategory] = useState('')
  const [entryCard, setEntryCard] = useState('')
  const [entryDueDay, setEntryDueDay] = useState('')
  const [entryDueDate, setEntryDueDate] = useState(dateInputValue(appDate))
  const [availableCardName, setAvailableCardName] = useState('')
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const searchInputRef = useRef(null)
  const searchContainerRef = useRef(null)
  const authUserIdRef = useRef('')
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileUser, setProfileUser] = useState(null)
  const profileContainerRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const cloudRequestKey = session ? `${session.user.id}:${cloudRefreshCount}` : ''
  const cloudDataLoading = Boolean(session && cloudLoadedKey !== cloudRequestKey && !cloudLoadError)

  useEffect(() => {
    if (!supabaseConfigured || !supabase) {
      return undefined
    }

    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) throw error
        setSession(data.session)
      })
      .catch((error) => setCloudError(`Could not check your Supabase session: ${error.message}`))
      .finally(() => setAuthLoading(false))

    const { data: authListener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      const nextUserId = nextSession?.user.id || ''
      if (authUserIdRef.current !== nextUserId) {
        setLoginStreak(null)
        setStreakError('')
      }
      setStreakError('')
      if (authUserIdRef.current && authUserIdRef.current !== nextUserId) {
        setCareerTopics([])
        setSelectedCareerGoal('')
        setSelectedCareerTopicId('')
        setCareerTopicNotes('')
      }
      authUserIdRef.current = nextUserId
      setSession(nextSession)
      setAuthLoading(false)
      setCloudError('')
      setCloudLoadError('')
      setRealtimeStatus(nextSession ? 'connecting' : 'disconnected')
      if (event === 'PASSWORD_RECOVERY') {
        setAuthMode('recovery')
        setAuthPassword('')
        setCloudNotice('Enter a new password for your account.')
      }
    })

    return () => authListener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const today = dateInputValue(new Date())
      setNotificationDate((current) => current === today ? current : today)
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!session || !supabase) return undefined

    let active = true
    const today = dateInputValue(new Date())

    const updateLoginStreak = async () => {
      const { error: checkInError } = await supabase
        .from('user_login_days')
        .upsert({ user_id: session.user.id, activity_date: today }, {
          onConflict: 'user_id,activity_date',
          ignoreDuplicates: true,
        })
      if (checkInError) throw checkInError

      const { data, error } = await supabase
        .from('user_login_days')
        .select('activity_date')
        .eq('user_id', session.user.id)
        .order('activity_date', { ascending: false })
      if (error) throw error
      if (active) setLoginStreak(getLoginStreak(data.map((row) => row.activity_date), today))
    }

    updateLoginStreak()
      .catch((error) => {
        if (active) setStreakError(`Could not update your login streak: ${error.message}`)
      })

    return () => {
      active = false
    }
  }, [session])

  useEffect(() => {
    if (!session || !supabase) return undefined

    let active = true
    const userId = session.user.id
    const refreshData = () => setCloudRefreshCount((count) => count + 1)
    const channel = supabase
      .channel(`money-data:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cards', filter: `user_id=eq.${userId}` }, refreshData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'available_credit_cards', filter: `user_id=eq.${userId}` }, refreshData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'holdings', filter: `user_id=eq.${userId}` }, refreshData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions', filter: `user_id=eq.${userId}` }, refreshData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'career_skill_topics', filter: `user_id=eq.${userId}` }, () => {
        setCareerTopicsLoading(true)
        setCareerTopicsReload((count) => count + 1)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emis', filter: `user_id=eq.${userId}` }, refreshData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'money_entries', filter: `user_id=eq.${userId}` }, refreshData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips', filter: `user_id=eq.${userId}` }, () => setTripsReload((count) => count + 1))
      .subscribe((status, error) => {
        if (!active) return
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('connected')
          refreshData()
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRealtimeStatus('error')
          setCloudError(`Live updates are unavailable: ${error?.message || status}. Enable Realtime for the finance tables in Supabase.`)
        } else if (status === 'CLOSED') {
          setRealtimeStatus('disconnected')
        }
      })

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [session])

  useEffect(() => {
    if (!session || !supabase || !selectedCareerGoal) return undefined

    let active = true

    supabase
      .from('career_skill_topics')
      .select('id, goal_title, parent_id, title, notes, created_at, updated_at')
      .eq('user_id', session.user.id)
      .eq('goal_title', selectedCareerGoal)
      .order('created_at')
      .then(({ data, error }) => {
        if (error) throw error
        if (!active) return
        setCareerTopics(data)
        setCareerTopicsError('')
        if (selectedCareerTopicId && !data.some((topic) => topic.id === selectedCareerTopicId)) {
          setSelectedCareerTopicId('')
          setCareerTopicNotes('')
        }
      })
      .catch((error) => {
        if (active) setCareerTopicsError(`Could not load your topics: ${error.message}`)
      })
      .finally(() => {
        if (active) setCareerTopicsLoading(false)
      })

    return () => {
      active = false
    }
  }, [session, selectedCareerGoal, careerTopicsReload, selectedCareerTopicId])

  useEffect(() => {
    if (!session || !supabase) return undefined

    let active = true

    const loadFinanceData = async () => {
      await Promise.resolve()
      if (!active) return

      try {
        const backupKey = 'daymark-pre-supabase-finance-v1'
        if (!window.localStorage.getItem(backupKey)) {
          const localFinance = {
            transactions: JSON.parse(window.localStorage.getItem('daymark-transactions') || '[]'),
            emis: JSON.parse(window.localStorage.getItem('daymark-emis') || '[]'),
            cards: JSON.parse(window.localStorage.getItem('daymark-cards') || '[]'),
          }
          if (Object.values(localFinance).some((records) => records.length > 0)) {
            window.localStorage.setItem(backupKey, JSON.stringify(localFinance))
          }
        }
      } catch (error) {
        throw new Error(`Could not preserve your existing browser-only finance records: ${error.message}`)
      }

      const [cardResult, availableCardResult, holdingResult, subscriptionResult, emiResult, entryResult] = await Promise.all([
        supabase.from('cards').select('*').order('created_at'),
        supabase.from('available_credit_cards').select('id, name, created_at').order('created_at'),
        supabase.from('holdings').select('id, name, sip_frequency, daily_sip, monthly_sip, current_value, created_at').order('created_at'),
        supabase.from('subscriptions').select('id, name, amount, start_date, end_date, created_at').order('start_date', { ascending: false }),
        supabase.from('emis').select('*').order('created_at'),
        supabase.from('money_entries').select('*').order('entry_date', { ascending: false }),
      ])
      const failedResult = [cardResult, availableCardResult, holdingResult, subscriptionResult, emiResult, entryResult].find((result) => result.error)
      if (failedResult?.error) throw failedResult.error
      if (!active) return

      const loadedCards = cardResult.data.filter((row) => row.record_type !== 'chit_fund').map(fromCardRow)
      const loadedChitFunds = cardResult.data.filter((row) => row.record_type === 'chit_fund').map(fromChitFundRow)
      const loadedEntries = entryResult.data.map((row) => fromMoneyEntryRow(row, loadedCards))
      setCards(loadedCards)
      setChitFunds(loadedChitFunds)
      setAvailableCards(availableCardResult.data)
      setHoldings(holdingResult.data)
      setSubscriptions(subscriptionResult.data)
      setEmis(emiResult.data.map(fromEmiRow))
      setTransactions(loadedEntries)
      setCloudNotice('')
      setCloudLoadedKey(cloudRequestKey)
    }

    loadFinanceData().catch((error) => {
      if (!active) return
      const message = error.message.startsWith('Could not preserve')
        ? error.message
        : `Could not load your Supabase money data: ${error.message}`
      setCloudLoadError(message)
    })

    return () => {
      active = false
    }
  }, [session, cloudRequestKey, setCards, setEmis, setTransactions])

  useEffect(() => {
    if (!session || !supabase) return undefined

    let active = true
    const loadTrips = async () => {
      const { data, error } = await supabase
        .from('trips')
        .select('id, title, trip_date, notes, media, created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      if (active) {
        setTrips(data)
        setTripsError('')
      }
    }

    loadTrips()
      .catch((error) => {
        if (active) setTripsError(`Could not load your trips: ${error.message}`)
      })
      .finally(() => {
        if (active) {
          setTripsLoading(false)
          setTripsLoaded(true)
        }
      })

    return () => {
      active = false
    }
  }, [session, tripsReload])

  useEffect(() => {
    const handleSearchShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInputRef.current?.focus()
        setSearchOpen(true)
      } else if (event.key === 'Escape') {
        setSearchOpen(false)
        setProfileOpen(false)
        searchInputRef.current?.blur()
      }
    }

    const handleOutsidePointer = (event) => {
      if (!searchContainerRef.current?.contains(event.target)) setSearchOpen(false)
      if (!profileContainerRef.current?.contains(event.target)) setProfileOpen(false)
    }

    window.addEventListener('keydown', handleSearchShortcut)
    document.addEventListener('pointerdown', handleOutsidePointer)
    return () => {
      window.removeEventListener('keydown', handleSearchShortcut)
      document.removeEventListener('pointerdown', handleOutsidePointer)
    }
  }, [])

  useEffect(() => {
    if (!selectedTrip) return undefined

    let active = true
    const loadTripMedia = async () => {
      const media = Array.isArray(selectedTrip.media) ? selectedTrip.media : []
      const signedMedia = await Promise.all(media.map(async (item) => {
        const { data, error } = await supabase.storage
          .from(tripMediaBucket)
          .createSignedUrl(item.path, 60 * 60)
        if (error) throw error
        return { ...item, url: data.signedUrl }
      }))
      if (active) {
        setTripSignedMedia(signedMedia)
        setTripCarouselIndex(0)
      }
    }

    loadTripMedia()
      .catch((error) => {
        if (active) setTripMediaError(`Could not load trip memories: ${error.message}`)
      })
      .finally(() => {
        if (active) setTripMediaLoading(false)
      })

    return () => {
      active = false
    }
  }, [selectedTrip, tripMediaReload])

  useEffect(() => {
    if (!tripCarouselExpanded) return undefined

    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setTripCarouselExpanded(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [tripCarouselExpanded])

  useEffect(() => {
    if (!selectedIdea) return undefined

    let active = true
    const noteConfig = noteTableByType[selectedNoteType]

    const loadSavedNote = async () => {
      if (!supabase || !session) throw new Error('Sign in to load your saved research notes.')

      const { data, error } = await supabase
        .from(noteConfig.table)
        .select('content, image_paths')
        .eq('user_id', session.user.id)
        .eq(noteConfig.idColumn, selectedIdea.id)
        .maybeSingle()
      if (error) throw error

      const imagePaths = Array.isArray(data?.image_paths)
        ? data.image_paths.filter((path) => typeof path === 'string')
        : []
      const images = await Promise.all(imagePaths.map(async (path) => {
        const { data: signedImage, error: signedImageError } = await supabase.storage
          .from(businessImageBucket)
          .createSignedUrl(path, 60 * 60)
        if (signedImageError) throw signedImageError
        return { path, url: signedImage.signedUrl }
      }))
      if (!active) return

      setBusinessNote(data?.content || '')
      setBusinessNoteImagePaths(imagePaths)
      setBusinessNoteInitialImagePaths(imagePaths)
      setBusinessNoteImages(images)
    }

    loadSavedNote()
      .catch((error) => {
        if (active) setBusinessNoteLoadError(`Could not load notes for this ${selectedNoteType === 'business' ? 'idea' : 'goal'}: ${error.message}`)
      })
      .finally(() => {
        if (active) setBusinessNoteLoading(false)
      })

    return () => {
      active = false
    }
  }, [session, selectedIdea, selectedNoteType, businessNoteReload])

  const visibleIdeas = useMemo(() => ideas.filter((idea) => (
    `${idea.title} ${idea.category} ${idea.note}`.toLowerCase().includes(query.toLowerCase())
  )), [ideas, query])
  const activeMonthIndex = selectedMonth ?? appDate.getMonth()
  const selectedMonthKey = `${selectedYear}-${String(activeMonthIndex + 1).padStart(2, '0')}`
  const tripCarouselItems = [
    ...tripSignedMedia,
    ...tripMediaFiles.map((item) => ({ ...item, url: item.previewUrl, local: true })),
  ]
  const yearTransactions = transactions.filter((entry) => entry.date?.slice(0, 4) === String(selectedYear))
  const monthTransactions = yearTransactions.filter((entry) => entry.date?.slice(0, 7) === selectedMonthKey)
  const totalHoldingsValue = holdings.reduce((total, holding) => total + Number(holding.current_value || 0), 0)
  const totalMonthlySip = holdings.reduce((total, holding) => (
    total + (holding.sip_frequency === 'daily'
      ? Number(holding.daily_sip || 0) * 30
      : Number(holding.monthly_sip || 0))
  ), 0)
  const totalChitFundHolding = chitFunds.reduce((total, chitFund) => {
    const months = getMonthsInRange(chitFund.startDate, chitFund.endDate)
    const paidMonthKeys = new Set(months.map((month) => month.key))
    const paidMonthCount = chitFund.paidMonths.filter((payment) => paidMonthKeys.has(payment.month)).length
    return total + paidMonthCount * chitFund.monthlyAmount
  }, 0)
  const activeEmis = emis.filter((emi) => !emi.isCompleted)
  const completedEmis = emis.filter((emi) => emi.isCompleted)
  const monthlyEmiPayments = monthTransactions.filter((entry) => entry.category === 'EMI payment')
  const totalMonthlyEmi = activeEmis.reduce((total, emi) => total + Number(emi.amount), 0)
  const totalMonthlyEmiPayments = monthlyEmiPayments
    .filter((payment) => activeEmis.some((emi) => payment.emiId === emi.id || (!payment.emiId && payment.name === emi.name)))
    .reduce((total, payment) => total + Number(payment.amount), 0)
  const remainingMonthlyEmi = Math.max(0, totalMonthlyEmi - totalMonthlyEmiPayments)
  const totalIncome = monthTransactions.filter((entry) => entry.type === 'Income').reduce((total, entry) => total + Number(entry.amount), 0)
  const totalOutgoings = monthTransactions.filter((entry) => entry.type !== 'Income').reduce((total, entry) => total + Number(entry.amount), 0)
  const remainingMonthlyBalance = totalIncome - totalOutgoings
  const monthlyTotals = monthNames.map((name, monthIndex) => {
    const key = `${selectedYear}-${String(monthIndex + 1).padStart(2, '0')}`
    const entries = yearTransactions.filter((entry) => entry.date?.slice(0, 7) === key)
    return {
      name,
      index: monthIndex,
      income: entries.filter((entry) => entry.type === 'Income').reduce((total, entry) => total + Number(entry.amount), 0),
      spending: entries.filter((entry) => entry.type !== 'Income').reduce((total, entry) => total + Number(entry.amount), 0),
    }
  })
  const availableYears = [...new Set([appDate.getFullYear() - 2, appDate.getFullYear() - 1, appDate.getFullYear(), appDate.getFullYear() + 1, appDate.getFullYear() + 2, ...transactions.map((entry) => Number(entry.date?.slice(0, 4))).filter(Number.isFinite)])].sort((a, b) => b - a)

  const submitAuth = async (event) => {
    event.preventDefault()
    if (!supabase) return
    setCloudError('')
    setCloudNotice('')
    try {
      const result = authMode === 'signin'
        ? await supabase.auth.signInWithPassword({ email: authEmail.trim(), password: authPassword })
        : await supabase.auth.signUp({ email: authEmail.trim(), password: authPassword })

      if (result.error) throw result.error
      if (authMode === 'signup' && !result.data.session) {
        setCloudNotice('Check your email to confirm your account, then sign in.')
        return
      }
      setAuthPassword('')
    } catch (error) {
      setCloudError(`Authentication failed: ${error.message}`)
    }
  }

  const requestPasswordReset = async (event) => {
    event.preventDefault()
    if (!supabase) return
    setCloudError('')
    setCloudNotice('')
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(authEmail.trim(), {
        redirectTo: window.location.origin,
      })
      if (error) throw error
      setCloudNotice('If an account exists for this email, Supabase will send a password reset link. Check your inbox and spam folder.')
    } catch (error) {
      setCloudError(`Could not request a password reset: ${error.message}`)
    }
  }

  const updatePassword = async (event) => {
    event.preventDefault()
    if (!supabase) return
    if (authPassword.length < 6) {
      setCloudError('Use a password with at least 6 characters.')
      return
    }
    setCloudError('')
    setCloudNotice('')
    try {
      const { error } = await supabase.auth.updateUser({ password: authPassword })
      if (error) throw error
      setAuthPassword('')
      setAuthMode('signin')
      setCloudNotice('Password changed. You can now sign in with your new password.')
      await supabase.auth.signOut()
    } catch (error) {
      setCloudError(`Could not update your password: ${error.message}`)
    }
  }

  const signOut = async () => {
    if (!supabase) return
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setSession(null)
      setRealtimeStatus('disconnected')
      setCloudNotice('')
      setCloudError('')
    } catch (error) {
      setCloudError(`Could not sign out: ${error.message}`)
    }
  }

  const loadProfile = async () => {
    setProfileLoading(true)
    setProfileError('')
    try {
      if (!supabase) throw new Error('Supabase is not configured.')
      const { data, error } = await supabase.auth.getUser()
      if (error) throw error
      if (!data.user) throw new Error('No signed-in user was returned.')
      setProfileUser(data.user)
    } catch (error) {
      setProfileError(`Could not load your account details: ${error.message}`)
    } finally {
      setProfileLoading(false)
    }
  }

  const toggleProfile = () => {
    if (profileOpen) {
      setProfileOpen(false)
      return
    }

    setProfileOpen(true)
    loadProfile()
  }

  const downloadLocalFinanceBackup = () => {
    try {
      const backup = window.localStorage.getItem('daymark-pre-supabase-finance-v1')
      if (!backup) return
      const downloadUrl = URL.createObjectURL(new Blob([backup], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = 'daymark-local-finance-backup.json'
      link.click()
      URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      setCloudError(`Could not download the local finance backup: ${error.message}`)
    }
  }

  const openAddIdea = () => {
    setIdeaTitle('')
    setIdeaNote('')
    setModalOpen(true)
  }

  const openSavedNotes = (item, type) => {
    setSelectedNoteType(type)
    setSelectedIdea(item)
    setBusinessNoteLoading(true)
    setBusinessNote('')
    setBusinessNoteImagePaths([])
    setBusinessNoteInitialImagePaths([])
    setBusinessNoteImages([])
    setBusinessNoteFiles([])
    setBusinessNoteLoadError('')
    setBusinessNoteError('')
    setBusinessImageError('')
  }

  const openIdeaNotes = (idea) => openSavedNotes(idea, 'business')

  const openPersonalGoalNotes = (goal) => {
    const id = goal.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    openSavedNotes({ id, title: goal.title }, 'personal')
  }

  const openTrips = () => {
    setTripsError('')
    if (!tripsLoaded) setTripsLoading(true)
    setPersonalView('trips')
  }

  const openTrip = (trip) => {
    setSelectedTrip(trip)
    setTripTitle(trip.title || '')
    setTripDate(trip.trip_date || '')
    setTripNotes(trip.notes || '')
    setTripMediaPaths(Array.isArray(trip.media) ? trip.media : [])
    setTripMediaFiles([])
    setTripSignedMedia([])
    setTripMediaError('')
    setTripMediaLoading(true)
    setTripCarouselIndex(0)
  }

  const closeTrip = () => {
    tripMediaFiles.forEach((media) => URL.revokeObjectURL(media.previewUrl))
    setTripMediaFiles([])
    setSelectedTrip(null)
    setTripMediaError('')
  }

  const createTrip = async (event) => {
    event.preventDefault()
    if (!supabase || !session) {
      setTripsError('Sign in to add a trip.')
      return
    }

    const title = newTripTitle.trim()
    if (!title) return
    const date = newTripDate.trim()

    setTripSaving(true)
    setTripsError('')
    try {
      const { data, error } = await supabase.from('trips').insert({
        user_id: session.user.id,
        title,
        trip_date: date,
      }).select('id, title, trip_date, notes, media, created_at').single()
      if (error) throw error

      setTrips((current) => [data, ...current])
      setNewTripTitle('')
      setNewTripDate('')
      setAddTripOpen(false)
      setNotice(`Trip "${title}" added.`)
      window.setTimeout(() => setNotice(''), 2600)
    } catch (error) {
      setTripsError(`Could not add this trip: ${error.message}`)
    } finally {
      setTripSaving(false)
    }
  }

  const deleteTrip = async (trip) => {
    if (!window.confirm(`Delete "${trip.title}" and all its saved memories? This cannot be undone.`)) return
    if (!supabase || !session) {
      setTripsError('Sign in to delete this trip.')
      return
    }

    setTripsError('')
    setDeletingTripIds((current) => [...current, trip.id])
    try {
      const { error } = await supabase
        .from('trips')
        .delete()
        .eq('id', trip.id)
        .eq('user_id', session.user.id)
        .select('id')
        .single()
      if (error) throw error

      setTrips((current) => current.filter((entry) => entry.id !== trip.id))
      if (selectedTrip?.id === trip.id) closeTrip()

      const mediaPaths = (Array.isArray(trip.media) ? trip.media : [])
        .map((item) => item?.path)
        .filter((path) => typeof path === 'string' && path.length > 0)
      let cleanupError = ''
      if (mediaPaths.length) {
        try {
          const { error: removeError } = await supabase.storage.from(tripMediaBucket).remove(mediaPaths)
          if (removeError) cleanupError = removeError.message
        } catch (error) {
          cleanupError = error.message
        }
      }

      if (cleanupError) {
        setTripsError(`Trip "${trip.title}" was deleted, but its saved memories could not be removed from storage: ${cleanupError}`)
      } else {
        setNotice(`Trip "${trip.title}" and its memories were deleted.`)
        window.setTimeout(() => setNotice(''), 2600)
      }
    } catch (error) {
      setTripsError(`Could not delete trip "${trip.title}": ${error.message}`)
    } finally {
      setDeletingTripIds((current) => current.filter((id) => id !== trip.id))
    }
  }

  const selectTripMedia = (event) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    const availableSlots = maxTripMedia - tripMediaPaths.length - tripMediaFiles.length
    const acceptedFiles = []
    let validationMessage = ''

    for (const file of files) {
      const isImage = file.type.startsWith('image/')
      const isVideo = file.type.startsWith('video/')
      if (!Object.hasOwn(tripMediaTypes, file.type)) {
        validationMessage = 'Use JPEG, PNG, WebP, GIF, MP4, WebM, or MOV files.'
      } else if (isImage && file.size > maxTripPhotoSize) {
        validationMessage = 'Each photo must be 10 MB or smaller.'
      } else if (isVideo && file.size > maxTripVideoSize) {
        validationMessage = 'Each video must be 50 MB or smaller.'
      } else if (acceptedFiles.length >= availableSlots) {
        validationMessage = `You can attach up to ${maxTripMedia} memories to one trip.`
      } else {
        acceptedFiles.push({
          file,
          name: file.name,
          type: file.type,
          previewUrl: URL.createObjectURL(file),
        })
      }
    }

    setTripMediaFiles((current) => [...current, ...acceptedFiles])
    setTripMediaError(validationMessage)
  }

  const saveTrip = async (event) => {
    event.preventDefault()
    if (!supabase || !session || !selectedTrip) return

    const title = tripTitle.trim()
    if (!title) {
      setTripMediaError('Trip name cannot be empty.')
      return
    }

    setTripMediaError('')
    setTripSaving(true)
    const uploadedPaths = []
    try {
      for (const item of tripMediaFiles) {
        const path = `${session.user.id}/${selectedTrip.id}/${window.crypto.randomUUID()}.${tripMediaTypes[item.type]}`
        const { error } = await supabase.storage
          .from(tripMediaBucket)
          .upload(path, item.file, { contentType: item.type, upsert: false })
        if (error) throw error
        uploadedPaths.push({ path, name: item.name, type: item.type })
      }

      const media = [...tripMediaPaths, ...uploadedPaths]
      const { data, error } = await supabase
        .from('trips')
        .update({ title, trip_date: tripDate.trim(), notes: tripNotes, media, updated_at: new Date().toISOString() })
        .eq('id', selectedTrip.id)
        .eq('user_id', session.user.id)
        .select('id, title, trip_date, notes, media, created_at')
        .single()
      if (error) throw error

      const retainedPaths = new Set(media.map((item) => item.path))
      const removedPaths = (Array.isArray(selectedTrip.media) ? selectedTrip.media : [])
        .filter((item) => !retainedPaths.has(item.path))
        .map((item) => item.path)
      let cleanupNotice = ''
      if (removedPaths.length) {
        try {
          const { error: removeError } = await supabase.storage.from(tripMediaBucket).remove(removedPaths)
          if (removeError) cleanupNotice = ` Trip saved, but removed memory cleanup failed: ${removeError.message}`
        } catch (removeError) {
          cleanupNotice = ` Trip saved, but removed memory cleanup failed: ${removeError.message}`
        }
      }

      tripMediaFiles.forEach((item) => URL.revokeObjectURL(item.previewUrl))
      setTripMediaFiles([])
      setTripMediaPaths(media)
      setSelectedTrip(data)
      setTrips((current) => current.map((trip) => trip.id === data.id ? data : trip))
      setTripMediaLoading(true)
      setNotice(`Trip "${data.title}" saved.${cleanupNotice}`)
      window.setTimeout(() => setNotice(''), 5000)
    } catch (error) {
      let message = error.message
      if (uploadedPaths.length) {
        try {
          const { error: cleanupError } = await supabase.storage.from(tripMediaBucket).remove(uploadedPaths.map((item) => item.path))
          if (cleanupError) message += ` Uploaded memory cleanup failed: ${cleanupError.message}`
        } catch (cleanupError) {
          message += ` Uploaded memory cleanup failed: ${cleanupError.message}`
        }
      }
      setTripMediaError(`Could not save this trip: ${message}`)
    } finally {
      setTripSaving(false)
    }
  }

  const removeTripMemory = (path) => {
    setTripMediaPaths((current) => current.filter((item) => item.path !== path))
    setTripSignedMedia((current) => current.filter((item) => item.path !== path))
    setTripCarouselIndex(0)
  }

  const closeIdeaNotes = () => {
    businessNoteFiles.forEach((image) => URL.revokeObjectURL(image.previewUrl))
    setBusinessNoteFiles([])
    setSelectedIdea(null)
  }

  const selectBusinessNoteImages = (event) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    const availableSlots = maxBusinessImages - businessNoteImagePaths.length - businessNoteFiles.length
    const acceptedFiles = []
    let validationMessage = ''

    for (const file of files) {
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
        validationMessage = 'Use JPEG, PNG, WebP, or GIF images.'
      } else if (file.size > maxBusinessImageSize) {
        validationMessage = 'Each image must be 5 MB or smaller.'
      } else if (acceptedFiles.length >= availableSlots) {
        validationMessage = `You can attach up to ${maxBusinessImages} images to one idea.`
      } else {
        acceptedFiles.push({ file, previewUrl: URL.createObjectURL(file) })
      }
    }

    setBusinessNoteFiles((current) => [...current, ...acceptedFiles])
    setBusinessImageError(validationMessage)
  }

  const saveBusinessNote = async (event) => {
    event.preventDefault()
    if (!supabase || !session || !selectedIdea) return
    const noteConfig = noteTableByType[selectedNoteType]
    setBusinessNoteError('')
    setBusinessImageError('')
    setBusinessNoteSaving(true)

    const uploadedPaths = []
    try {
      const extensionByType = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif',
      }

      for (const image of businessNoteFiles) {
        const path = `${session.user.id}/${noteConfig.pathPrefix}${selectedIdea.id}/${window.crypto.randomUUID()}.${extensionByType[image.file.type]}`
        const { error } = await supabase.storage
          .from(businessImageBucket)
          .upload(path, image.file, { contentType: image.file.type, upsert: false })
        if (error) throw error
        uploadedPaths.push(path)
      }

      const imagePaths = [...businessNoteImagePaths, ...uploadedPaths]
      const { error } = await supabase.from(noteConfig.table).upsert({
        user_id: session.user.id,
        [noteConfig.idColumn]: selectedIdea.id,
        [noteConfig.titleColumn]: selectedIdea.title,
        content: businessNote,
        image_paths: imagePaths,
        updated_at: new Date().toISOString(),
      }, { onConflict: `user_id,${noteConfig.idColumn}` })
      if (error) throw error

      const removedPaths = businessNoteInitialImagePaths.filter((path) => !imagePaths.includes(path))
      let cleanupNotice = ''
      if (removedPaths.length) {
        try {
          const { error: removeError } = await supabase.storage.from(businessImageBucket).remove(removedPaths)
          if (removeError) cleanupNotice = ` Notes were saved, but removed image cleanup failed: ${removeError.message}`
        } catch (removeError) {
          cleanupNotice = ` Notes were saved, but removed image cleanup failed: ${removeError.message}`
        }
      }

      setNotice(`Notes saved for ${selectedIdea.title}.${cleanupNotice}`)
      window.setTimeout(() => setNotice(''), 5000)
      closeIdeaNotes()
    } catch (error) {
      let message = error.message
      if (uploadedPaths.length) {
        try {
          const { error: cleanupError } = await supabase.storage.from(businessImageBucket).remove(uploadedPaths)
          if (cleanupError) message += ` Uploaded image cleanup failed: ${cleanupError.message}`
        } catch (cleanupError) {
          message += ` Uploaded image cleanup failed: ${cleanupError.message}`
        }
      }
      setBusinessNoteError(`Could not save your notes: ${message}`)
    } finally {
      setBusinessNoteSaving(false)
    }
  }

  const deleteIdea = async (idea) => {
    if (!window.confirm(`Delete "${idea.title}" and all its saved notes? This cannot be undone.`)) return
    if (!supabase || !session) {
      setCloudError('Sign in to delete this business idea.')
      return
    }

    setCloudError('')
    setDeletingIdeaIds((current) => [...current, idea.id])
    try {
      const { data: note, error: loadError } = await supabase
        .from('business_exploration_notes')
        .select('image_paths')
        .eq('user_id', session.user.id)
        .eq('idea_id', idea.id)
        .maybeSingle()
      if (loadError) throw loadError

      const { error } = await supabase
        .from('business_exploration_notes')
        .delete()
        .eq('user_id', session.user.id)
        .eq('idea_id', idea.id)
      if (error) throw error

      setIdeas((current) => current.filter((entry) => entry.id !== idea.id))
      if (selectedIdea?.id === idea.id) closeIdeaNotes()

      let cleanupNotice = ''
      const imagePaths = Array.isArray(note?.image_paths)
        ? note.image_paths.filter((path) => typeof path === 'string')
        : []
      if (imagePaths.length) {
        try {
          const { error: removeError } = await supabase.storage.from(businessImageBucket).remove(imagePaths)
          if (removeError) cleanupNotice = ` The idea and notes were deleted, but image cleanup failed: ${removeError.message}`
        } catch (removeError) {
          cleanupNotice = ` The idea and notes were deleted, but image cleanup failed: ${removeError.message}`
        }
      }

      setNotice(`Deleted "${idea.title}".${cleanupNotice}`)
      window.setTimeout(() => setNotice(''), 5000)
    } catch (error) {
      setCloudError(`Could not delete "${idea.title}": ${error.message}`)
    } finally {
      setDeletingIdeaIds((current) => current.filter((id) => id !== idea.id))
    }
  }

  const addIdea = (event) => {
    event.preventDefault()
    const title = ideaTitle.trim()
    if (!title) return
    setIdeas((current) => [{ id: window.crypto.randomUUID(), title, category: 'Business exploration', note: ideaNote.trim() || 'A new thought to explore.', color: 'mint', stage: 'To explore', icon: 'spark' }, ...current])
    setModalOpen(false)
    setNotice('Your idea has been added.')
    window.setTimeout(() => setNotice(''), 2600)
  }

  const openCareerGoal = (goal) => {
    setActivePage('Career & skills')
    setSelectedCareerGoal(goal.title)
    setSelectedCareerTopicId('')
    setCareerTopicNotes('')
    setNewCareerTopicTitle('')
    setCareerTopics([])
    setCareerTopicsError('')
    setCareerTopicsLoading(true)
  }

  const closeCareerGoal = () => {
    const topic = careerTopics.find((item) => item.id === selectedCareerTopicId)
    if (topic && topic.notes !== careerTopicNotes && !window.confirm('Discard your unsaved notes and go back?')) return
    setSelectedCareerGoal('')
    setSelectedCareerTopicId('')
    setCareerTopicNotes('')
    setNewCareerTopicTitle('')
    setCareerTopicsError('')
  }

  const selectCareerTopic = (topic) => {
    const currentTopic = careerTopics.find((item) => item.id === selectedCareerTopicId)
    if (currentTopic && currentTopic.id !== topic.id && currentTopic.notes !== careerTopicNotes && !window.confirm('Discard your unsaved notes and open another topic?')) return
    setSelectedCareerTopicId(topic.id)
    setCareerTopicNotes(topic.notes || '')
    setCareerTopicsError('')
  }

  const showAllCareerTopics = () => {
    const currentTopic = careerTopics.find((item) => item.id === selectedCareerTopicId)
    if (currentTopic && currentTopic.notes !== careerTopicNotes && !window.confirm('Discard your unsaved notes and go back to all topics?')) return
    setSelectedCareerTopicId('')
    setCareerTopicNotes('')
  }

  const addCareerTopic = async (event) => {
    event.preventDefault()
    const title = newCareerTopicTitle.trim()
    if (!title || !selectedCareerGoal || !supabase || !session) return
    const currentTopic = careerTopics.find((item) => item.id === selectedCareerTopicId)
    if (currentTopic && currentTopic.notes !== careerTopicNotes && !window.confirm('Discard your unsaved notes and add a subtopic?')) return

    setCareerTopicsError('')
    setCareerTopicSaving(true)
    try {
      const { data, error } = await supabase
        .from('career_skill_topics')
        .insert({
          user_id: session.user.id,
          goal_title: selectedCareerGoal,
          parent_id: selectedCareerTopicId || null,
          title,
        })
        .select('id, goal_title, parent_id, title, notes, created_at, updated_at')
        .single()
      if (error) throw error
      setCareerTopics((current) => [...current, data])
      setSelectedCareerTopicId(data.id)
      setCareerTopicNotes('')
      setNewCareerTopicTitle('')
      setNotice(`Added "${title}".`)
      window.setTimeout(() => setNotice(''), 2600)
    } catch (error) {
      setCareerTopicsError(`Could not add this topic: ${error.message}`)
    } finally {
      setCareerTopicSaving(false)
    }
  }

  const saveCareerTopicNotes = async (event) => {
    event.preventDefault()
    const topic = careerTopics.find((item) => item.id === selectedCareerTopicId)
    if (!topic || !supabase || !session) return

    setCareerTopicsError('')
    setCareerTopicSaving(true)
    try {
      const { data, error } = await supabase
        .from('career_skill_topics')
        .update({ notes: careerTopicNotes, updated_at: new Date().toISOString() })
        .eq('id', topic.id)
        .eq('user_id', session.user.id)
        .select('id, goal_title, parent_id, title, notes, created_at, updated_at')
        .single()
      if (error) throw error
      setCareerTopics((current) => current.map((item) => item.id === data.id ? data : item))
      setNotice('Notes saved.')
      window.setTimeout(() => setNotice(''), 2600)
    } catch (error) {
      setCareerTopicsError(`Could not save these notes: ${error.message}`)
    } finally {
      setCareerTopicSaving(false)
    }
  }

  const deleteCareerTopic = async (topic) => {
    if (!window.confirm(`Delete "${topic.title}" and all its subtopics? This cannot be undone.`)) return
    if (!supabase || !session) return

    setCareerTopicsError('')
    setCareerTopicSaving(true)
    try {
      const descendantIds = new Set([topic.id])
      let foundNewDescendant = true
      while (foundNewDescendant) {
        foundNewDescendant = false
        careerTopics.forEach((item) => {
          if (descendantIds.has(item.parent_id) && !descendantIds.has(item.id)) {
            descendantIds.add(item.id)
            foundNewDescendant = true
          }
        })
      }

      const { error } = await supabase
        .from('career_skill_topics')
        .delete()
        .eq('id', topic.id)
        .eq('user_id', session.user.id)
      if (error) throw error
      setCareerTopics((current) => current.filter((item) => !descendantIds.has(item.id)))
      if (descendantIds.has(selectedCareerTopicId)) {
        setSelectedCareerTopicId('')
        setCareerTopicNotes('')
      }
      setNotice(`Deleted "${topic.title}" and its subtopics.`)
      window.setTimeout(() => setNotice(''), 2600)
    } catch (error) {
      setCareerTopicsError(`Could not delete this topic: ${error.message}`)
    } finally {
      setCareerTopicSaving(false)
    }
  }

  const openMoneyForm = (type = 'transaction') => {
    setCloudError('')
    setEditingTransactionId(null)
    setEditingCommitmentId(null)
    setMoneyModalType(type)
    setEntryType(type === 'emi' ? 'EMI payment' : type === 'card' ? 'Card purchase' : 'Spending')
    setEntryName('')
    setEntryReason('')
    setEntryAmount('')
    setEntryDate(`${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${selectedYear === appDate.getFullYear() && selectedMonth === appDate.getMonth() ? String(appDate.getDate()).padStart(2, '0') : '01'}`)
    setEntryCategory(type === 'emi' ? 'EMI payment' : type === 'card' ? 'Credit card payment' : '')
    setEntryCard('')
    setEntryDueDay('')
    setEntryDueDate(dateInputValue(appDate))
    setEmiCompleted(false)
    setEmiEndDate('')
    setMoneyModalOpen(true)
  }

  const openEditCommitment = (type, commitment) => {
    setCloudError('')
    setEditingTransactionId(null)
    setEditingCommitmentId(commitment.id)
    setMoneyModalType(type)
    setEntryType(type === 'emi' ? 'EMI payment' : 'Card purchase')
    setEntryName(commitment.name)
    setEntryReason('')
    const openingBalance = type === 'card'
      ? cards.find((card) => card.id === commitment.id)?.amount ?? commitment.amount
      : commitment.amount
    setEntryAmount(String(openingBalance))
    setEntryDate(`${selectedYear}-${String((selectedMonth ?? appDate.getMonth()) + 1).padStart(2, '0')}-01`)
    setEntryCategory(type === 'emi' ? 'EMI payment' : 'Credit card payment')
    setEntryCard('')
    setEntryDueDay(type === 'card' ? commitment.dueDay : '')
    const emiDueDate = commitment.startDate || dateInputValue(new Date(
      appDate.getFullYear(),
      appDate.getMonth(),
      Math.min(Number(commitment.dueDay), new Date(appDate.getFullYear(), appDate.getMonth() + 1, 0).getDate()),
    ))
    setEntryDueDate(type === 'emi' ? emiDueDate : dateInputValue(appDate))
    setEmiCompleted(type === 'emi' && commitment.isCompleted)
    setEmiEndDate(type === 'emi' ? commitment.endDate : '')
    setMoneyModalOpen(true)
  }

  const openEditTransaction = (transaction) => {
    setCloudError('')
    setEditingTransactionId(transaction.id)
    setEditingCommitmentId(null)
    setMoneyModalType('transaction')
    setEntryType(transaction.type === 'Income' ? 'Income' : 'Spending')
    setEntryName(transaction.name)
    setEntryReason(transaction.reason || '')
    setEntryAmount(String(transaction.amount))
    setEntryDate(transaction.date)
    setEntryCategory(transaction.category || '')
    setEntryCard(transaction.cardName || '')
    setMoneyModalOpen(true)
  }

  const saveMoneyEntry = async (event) => {
    event.preventDefault()
    if (!supabase || !session) {
      setCloudError('Sign in to save EMI changes.')
      return
    }
    const amount = Number(entryAmount)
    const name = entryName.trim()
    const reason = entryReason.trim()
    if (!name) {
      setCloudError(moneyModalType === 'emi' ? 'Enter an EMI or loan name.' : 'Enter a name.')
      return
    }
    if (!Number.isFinite(amount) || (moneyModalType === 'card' ? amount < 0 : amount <= 0)) {
      setCloudError('Enter a valid amount.')
      return
    }
    if (moneyModalType === 'emi') {
      if (!entryDueDate) {
        setCloudError('Enter an EMI start date.')
        return
      }
      if (!emiEndDate) {
        setCloudError('Enter an EMI end date.')
        return
      }
      if (emiEndDate < entryDueDate) {
        setCloudError('EMI end date must be on or after its start date.')
        return
      }
    }
    if (moneyModalType === 'transaction' && entryType !== 'Income' && (!reason || !entryCategory)) {
      setCloudError('Enter a spending reason and payment source.')
      return
    }
    const id = editingCommitmentId || window.crypto.randomUUID()
    setCloudError('')
    setCloudLoading(true)
    try {
      if (moneyModalType === 'emi') {
        const draft = { id, name, amount, dueDay: Number(entryDueDate.slice(-2)), startDate: entryDueDate, endDate: emiEndDate, isCompleted: emiCompleted }
        const result = editingCommitmentId
          ? await supabase.from('emis').update({
            name,
            monthly_emi: amount,
            due_day: draft.dueDay,
            start_date: draft.startDate,
            end_date: draft.endDate,
            is_completed: draft.isCompleted,
          }).eq('id', editingCommitmentId).eq('user_id', session.user.id).select().single()
          : await supabase.from('emis').insert(toEmiRow(draft, session.user.id)).select().single()
        if (result.error) throw result.error
        const savedEmi = fromEmiRow(result.data)
        if (editingCommitmentId) {
          setEmis((current) => current.map((emi) => emi.id === editingCommitmentId ? savedEmi : emi))
        } else {
          setEmis((current) => [...current, savedEmi])
        }
      } else if (moneyModalType === 'card') {
        if (editingCommitmentId) {
          if (!cards.some((card) => card.id === editingCommitmentId)) throw new Error('The credit card could not be found.')
        }
        const draft = { id, name, amount, dueDay: entryDueDay }
        const result = editingCommitmentId
          ? await supabase.from('cards').update({
            name,
            due_day: entryDueDay ? Number(entryDueDay) : null,
            opening_balance: amount,
          }).eq('id', editingCommitmentId).eq('user_id', session.user.id).select().single()
          : await supabase.from('cards').insert(toCardRow(draft, session.user.id)).select().single()
        if (result.error) throw result.error
        const savedCard = fromCardRow(result.data)
        if (editingCommitmentId) {
          const oldCard = cards.find((card) => card.id === editingCommitmentId)
          setCards((current) => current.map((card) => card.id === editingCommitmentId ? savedCard : card))
          setTransactions((current) => current.map((entry) => (
            entry.cardId === editingCommitmentId || (!entry.cardId && entry.cardName === oldCard?.name)
              ? { ...entry, cardName: name }
              : entry
          )))
        } else {
          setCards((current) => [...current, savedCard])
        }
      } else {
        const updatedEntry = { id: editingTransactionId || id, name, reason, amount, date: entryDate, type: entryType, category: entryType === 'Income' ? '' : entryCategory, cardName: entryType === 'Income' ? '' : entryCard, holdingId: transactions.find((entry) => entry.id === editingTransactionId)?.holdingId || '' }
        const row = toMoneyEntryRow(updatedEntry, cards, emis, session.user.id)
        const result = editingTransactionId
          ? await supabase.from('money_entries').update(row).eq('id', editingTransactionId).select().single()
          : await supabase.from('money_entries').insert(row).select().single()
        if (result.error) throw result.error
        const savedEntry = fromMoneyEntryRow(result.data, cards)
        if (editingTransactionId) {
          setTransactions((current) => current.map((entry) => entry.id === editingTransactionId ? savedEntry : entry))
        } else {
          setTransactions((current) => [savedEntry, ...current])
        }
      }
      setMoneyModalOpen(false)
      setEditingTransactionId(null)
      setEditingCommitmentId(null)
      setNotice(moneyModalType === 'emi'
        ? `${editingCommitmentId ? 'EMI' : 'EMI reminder'} ${editingCommitmentId ? 'updated' : 'added'} in Supabase.`
        : moneyModalType === 'card'
          ? `Card ${editingCommitmentId ? 'updated' : 'saved'} in Supabase.`
          : editingTransactionId ? 'Payment updated in Supabase.' : 'Payment saved to Supabase.')
      window.setTimeout(() => setNotice(''), 2600)
    } catch (error) {
      setCloudError(`Could not save this record to Supabase: ${error.message}`)
    } finally {
      setCloudLoading(false)
    }
  }

  const recordCommitmentPayment = async (type, commitment) => {
    if (!supabase || !session) return
    const draft = {
      id: window.crypto.randomUUID(),
      name: commitment.name,
      amount: Number(commitment.amount),
      date: `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${selectedYear === appDate.getFullYear() && selectedMonth === appDate.getMonth() ? String(appDate.getDate()).padStart(2, '0') : '01'}`,
      type: 'Spending',
      category: type === 'EMI payment' ? 'EMI payment' : 'Card repayment',
      reason: `${type} for ${commitment.name}`,
      cardName: '',
    }
    if (type === 'EMI payment') draft.emiId = commitment.id
    setCloudError('')
    setCloudLoading(true)
    try {
      const { data, error } = await supabase.from('money_entries').insert(toMoneyEntryRow(draft, cards, emis, session.user.id)).select().single()
      if (error) throw error
      setTransactions((current) => [fromMoneyEntryRow(data, cards), ...current])
      setNotice(`${type} saved to Supabase.`)
      window.setTimeout(() => setNotice(''), 2600)
    } catch (error) {
      setCloudError(`Could not save this payment to Supabase: ${error.message}`)
    } finally {
      setCloudLoading(false)
    }
  }

  const deleteTransaction = async (transaction) => {
    if (!window.confirm(`Delete "${transaction.reason || transaction.name}"? This cannot be undone.`)) return
    if (!supabase || !session) return
    setCloudError('')
    setCloudLoading(true)
    try {
      const { error } = await supabase.from('money_entries').delete().eq('id', transaction.id)
      if (error) throw error
      setTransactions((current) => current.filter((entry) => entry.id !== transaction.id))
      setNotice('Payment deleted from Supabase.')
      window.setTimeout(() => setNotice(''), 2600)
    } catch (error) {
      setCloudError(`Could not delete this payment from Supabase: ${error.message}`)
    } finally {
      setCloudLoading(false)
    }
  }

  const deleteEmi = async (emi) => {
    if (!window.confirm(`Delete "${emi.name}" monthly commitment? Its payment history will be kept.`)) return
    if (!supabase || !session) return
    setCloudError('')
    setCloudLoading(true)
    try {
      const { error: linkError } = await supabase.from('money_entries').update({ emi_id: null }).eq('emi_id', emi.id)
      if (linkError) throw linkError
      const { error } = await supabase.from('emis').delete().eq('id', emi.id)
      if (error) throw error
      setEmis((current) => current.filter((entry) => entry.id !== emi.id))
      setTransactions((current) => current.map((entry) => (
        entry.emiId === emi.id ? { ...entry, emiId: '' } : entry
      )))
      setNotice('Monthly commitment deleted from Supabase.')
      window.setTimeout(() => setNotice(''), 2600)
    } catch (error) {
      setCloudError(`Could not delete this monthly commitment from Supabase: ${error.message}`)
    } finally {
      setCloudLoading(false)
    }
  }

  const resetChitFundForm = () => {
    setChitFundName('')
    setChitFundMonthlyAmount('')
    setChitFundStartDate('')
    setChitFundEndDate('')
    setEditingChitFundId(null)
    setChitFundError('')
    setChitFundFormOpen(false)
  }

  const editChitFund = (chitFund) => {
    setChitFundName(chitFund.name)
    setChitFundMonthlyAmount(String(chitFund.monthlyAmount))
    setChitFundStartDate(chitFund.startDate)
    setChitFundEndDate(chitFund.endDate)
    setEditingChitFundId(chitFund.id)
    setChitFundError('')
    setChitFundFormOpen(true)
  }

  const saveChitFund = async (event) => {
    event.preventDefault()
    const name = chitFundName.trim()
    const monthlyAmount = Number(chitFundMonthlyAmount)
    if (!name || !Number.isFinite(monthlyAmount) || monthlyAmount <= 0) {
      setChitFundError('Enter a chit fund name and a valid monthly amount.')
      return
    }
    if (!chitFundStartDate || !chitFundEndDate || chitFundEndDate < chitFundStartDate) {
      setChitFundError('Enter valid start and end dates. The end date must be on or after the start date.')
      return
    }
    const existingChitFund = chitFunds.find((item) => item.id === editingChitFundId)
    const allowedMonths = new Set(getMonthsInRange(chitFundStartDate, chitFundEndDate).map((month) => month.key))
    if (existingChitFund?.paidMonths.some((payment) => !allowedMonths.has(payment.month))) {
      setChitFundError('The selected date range must include all months already marked paid.')
      return
    }
    if (!supabase || !session) {
      setChitFundError('Sign in to save chit fund details.')
      return
    }

    const draft = {
      id: editingChitFundId || window.crypto.randomUUID(),
      name,
      monthlyAmount,
      startDate: chitFundStartDate,
      endDate: chitFundEndDate,
      paidMonths: existingChitFund?.paidMonths || [],
    }
    setChitFundError('')
    setCloudLoading(true)
    try {
      const result = editingChitFundId
        ? await supabase.from('cards').update(toChitFundRow(draft, session.user.id))
          .eq('id', editingChitFundId).eq('user_id', session.user.id).select('*').single()
        : await supabase.from('cards').insert(toChitFundRow(draft, session.user.id)).select('*').single()
      if (result.error) throw result.error
      const savedChitFund = fromChitFundRow(result.data)
      setChitFunds((current) => editingChitFundId
        ? current.map((item) => item.id === savedChitFund.id ? savedChitFund : item)
        : [...current, savedChitFund])
      setNotice(`Chit fund "${savedChitFund.name}" ${editingChitFundId ? 'updated' : 'added'}.`)
      window.setTimeout(() => setNotice(''), 2600)
      resetChitFundForm()
    } catch (error) {
      setChitFundError(`Could not save this chit fund: ${error.message}`)
    } finally {
      setCloudLoading(false)
    }
  }

  const toggleChitFundMonth = async (chitFund, monthKey) => {
    if (!supabase || !session) {
      setChitFundError('Sign in to update chit fund payments.')
      return
    }
    const monthsInRange = getMonthsInRange(chitFund.startDate, chitFund.endDate)
    if (!monthsInRange.some((month) => month.key === monthKey)) {
      setChitFundError('This month is outside the chit fund start and end dates.')
      return
    }

    const existingPayment = chitFund.paidMonths.find((payment) => payment.month === monthKey)
    setChitFundError('')
    setCloudLoading(true)
    try {
      let savedChitFund
      let savedEntry
      if (existingPayment) {
        const remainingPaidMonths = chitFund.paidMonths.filter((payment) => payment.month !== monthKey)
        const { data, error } = await supabase.from('cards')
          .update({ paid_months: remainingPaidMonths })
          .eq('id', chitFund.id)
          .eq('user_id', session.user.id)
          .select('*')
          .single()
        if (error) throw error
        savedChitFund = fromChitFundRow(data)

        if (existingPayment.moneyEntryId) {
          const { error: deleteEntryError } = await supabase.from('money_entries')
            .delete()
            .eq('id', existingPayment.moneyEntryId)
            .eq('user_id', session.user.id)
          if (deleteEntryError) {
            const { error: rollbackError } = await supabase.from('cards')
              .update({ paid_months: chitFund.paidMonths })
              .eq('id', chitFund.id)
              .eq('user_id', session.user.id)
            if (rollbackError) {
              throw new Error(`Could not remove the chit fund spending entry: ${deleteEntryError.message}. Restoring its paid status also failed: ${rollbackError.message}`)
            }
            throw deleteEntryError
          }
          setTransactions((current) => current.filter((entry) => entry.id !== existingPayment.moneyEntryId))
        }
      } else {
        const moneyEntryId = window.crypto.randomUUID()
        const transactionId = (chitTransactionIds[`${chitFund.id}:${monthKey}`] || '').trim()
        const draftEntry = {
          id: moneyEntryId,
          name: chitFund.name,
          reason: `Chit fund payment${transactionId ? ` · Transaction ID: ${transactionId}` : ''}`,
          amount: chitFund.monthlyAmount,
          date: `${monthKey}-01`,
          type: 'Spending',
          category: 'Other spending',
          cardName: '',
        }
        const entryResult = await supabase.from('money_entries')
          .insert(toMoneyEntryRow(draftEntry, cards, emis, session.user.id))
          .select('*')
          .single()
        if (entryResult.error) throw entryResult.error
        savedEntry = fromMoneyEntryRow(entryResult.data, cards)

        const paidMonths = [...chitFund.paidMonths, { month: monthKey, transactionId, moneyEntryId }]
        const { data, error } = await supabase.from('cards')
          .update({ paid_months: paidMonths })
          .eq('id', chitFund.id)
          .eq('user_id', session.user.id)
          .select('*')
          .single()
        if (error) {
          const { error: cleanupError } = await supabase.from('money_entries')
            .delete()
            .eq('id', moneyEntryId)
            .eq('user_id', session.user.id)
          if (cleanupError) {
            throw new Error(`Could not mark the month paid: ${error.message}. The spending entry also could not be removed: ${cleanupError.message}`)
          }
          throw error
        }
        savedChitFund = fromChitFundRow(data)
        setTransactions((current) => [savedEntry, ...current])
      }
      setChitFunds((current) => current.map((item) => item.id === savedChitFund.id ? savedChitFund : item))
      setNotice(`${existingPayment ? 'Marked unpaid' : 'Payment recorded'} for ${chitFund.name} · ${new Date(`${monthKey}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}.`)
      window.setTimeout(() => setNotice(''), 2600)
    } catch (error) {
      setChitFundError(`Could not update this chit fund month: ${error.message}`)
    } finally {
      setCloudLoading(false)
    }
  }

  const deleteChitFund = async (chitFund) => {
    if (!window.confirm(`Delete "${chitFund.name}" chit fund and its payment months? This cannot be undone.`)) return
    if (!supabase || !session) {
      setChitFundError('Sign in to delete this chit fund.')
      return
    }
    setChitFundError('')
    setCloudLoading(true)
    try {
      const { error } = await supabase.from('cards')
        .delete()
        .eq('id', chitFund.id)
        .eq('user_id', session.user.id)
      if (error) throw error
      setChitFunds((current) => current.filter((item) => item.id !== chitFund.id))
      if (editingChitFundId === chitFund.id) resetChitFundForm()
      setNotice(`Deleted chit fund "${chitFund.name}".`)
      window.setTimeout(() => setNotice(''), 2600)
    } catch (error) {
      setChitFundError(`Could not delete this chit fund: ${error.message}`)
    } finally {
      setCloudLoading(false)
    }
  }

  const addAvailableCard = async (event) => {
    event.preventDefault()
    const name = availableCardName.trim()
    if (!name || !supabase || !session) return
    if (availableCards.some((card) => card.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setCloudError(`"${name}" is already in your available credit cards.`)
      return
    }

    setCloudError('')
    setCloudLoading(true)
    try {
      const { data, error } = await supabase
        .from('available_credit_cards')
        .insert({ user_id: session.user.id, name })
        .select('id, name, created_at')
        .single()
      if (error) throw error
      setAvailableCards((current) => [...current, data])
      setAvailableCardName('')
      setNotice(`Added "${name}" to your available credit cards.`)
      window.setTimeout(() => setNotice(''), 2600)
    } catch (error) {
      setCloudError(`Could not add this available credit card: ${error.message}`)
    } finally {
      setCloudLoading(false)
    }
  }

  const deleteAvailableCard = async (card) => {
    if (!window.confirm(`Remove "${card.name}" from your available credit cards?`)) return
    if (!supabase || !session) return

    setCloudError('')
    setCloudLoading(true)
    try {
      const { error } = await supabase
        .from('available_credit_cards')
        .delete()
        .eq('id', card.id)
        .eq('user_id', session.user.id)
      if (error) throw error
      setAvailableCards((current) => current.filter((entry) => entry.id !== card.id))
      setNotice(`Removed "${card.name}" from your available credit cards.`)
      window.setTimeout(() => setNotice(''), 2600)
    } catch (error) {
      setCloudError(`Could not remove this available credit card: ${error.message}`)
    } finally {
      setCloudLoading(false)
    }
  }

  const resetHoldingForm = () => {
    setHoldingFormOpen(false)
    setEditingHoldingId(null)
    setHoldingName('')
    setHoldingFrequency('monthly')
    setHoldingSipAmount('')
    setHoldingCurrentValue('')
    setHoldingError('')
  }

  const editHolding = (holding) => {
    setHoldingFormOpen(true)
    setEditingHoldingId(holding.id)
    setHoldingName(holding.name)
    setHoldingFrequency(holding.sip_frequency || 'monthly')
    setHoldingSipAmount(holding.sip_frequency === 'daily' ? String(holding.daily_sip || '') : String(holding.monthly_sip || ''))
    setHoldingCurrentValue(String(holding.current_value))
    setHoldingError('')
  }

  const saveHolding = async (event) => {
    event.preventDefault()
    const name = holdingName.trim()
    const sipAmount = holdingSipAmount === '' ? 0 : Number(holdingSipAmount)
    const currentValue = Number(holdingCurrentValue)
    if (!name || !Number.isFinite(sipAmount) || sipAmount < 0 || !Number.isFinite(currentValue) || currentValue < 0) {
      setHoldingError('Enter a name and valid non-negative amounts.')
      return
    }
    if (holdingFrequency === 'daily' && sipAmount <= 0) {
      setHoldingError(`Enter a ${holdingFrequency} SIP amount greater than zero.`)
      return
    }
    if (!supabase || !session) {
      setHoldingError('Sign in to save holding details.')
      return
    }

    setHoldingError('')
    setCloudLoading(true)
    try {
      const values = {
        name,
        sip_frequency: holdingFrequency,
        daily_sip: holdingFrequency === 'daily' ? sipAmount : 0,
        monthly_sip: holdingFrequency === 'monthly' ? sipAmount : 0,
        current_value: currentValue,
      }
      const result = editingHoldingId
        ? await supabase.from('holdings').update(values).eq('id', editingHoldingId).eq('user_id', session.user.id)
          .select('id, name, sip_frequency, daily_sip, monthly_sip, current_value, created_at').single()
        : await supabase.from('holdings').insert({ ...values, user_id: session.user.id })
          .select('id, name, sip_frequency, daily_sip, monthly_sip, current_value, created_at').single()
      if (result.error) throw result.error

      setHoldings((current) => editingHoldingId
        ? current.map((holding) => holding.id === editingHoldingId ? result.data : holding)
        : [result.data, ...current])
      resetHoldingForm()
      setNotice(editingHoldingId ? 'Holding updated.' : `Added "${name}" holding.`)
      window.setTimeout(() => setNotice(''), 2600)
    } catch (error) {
      setHoldingError(`Could not save this holding: ${error.message}`)
    } finally {
      setCloudLoading(false)
    }
  }

  const deleteHolding = async (holding) => {
    if (!window.confirm(`Delete "${holding.name}" holding details? Logged SIP payments will remain in monthly spending.`)) return
    if (!supabase || !session) {
      setHoldingError('Sign in to delete holding details.')
      return
    }

    setHoldingError('')
    setCloudLoading(true)
    try {
      const { error } = await supabase.from('holdings').delete()
        .eq('id', holding.id)
        .eq('user_id', session.user.id)
      if (error) throw error
      setHoldings((current) => current.filter((entry) => entry.id !== holding.id))
      if (editingHoldingId === holding.id) resetHoldingForm()
      setNotice(`Deleted "${holding.name}" holding.`)
      window.setTimeout(() => setNotice(''), 2600)
    } catch (error) {
      setHoldingError(`Could not delete this holding: ${error.message}`)
    } finally {
      setCloudLoading(false)
    }
  }

  const logHoldingPayment = async (holding) => {
    if (!supabase || !session) {
      setCloudError('Sign in to log an SIP payment.')
      return
    }
    const isDaily = holding.sip_frequency === 'daily'
    if (!isDaily && (holdingPaymentFormId !== holding.id || holdingPaymentFormMonth !== selectedMonthKey)) {
      const existingPayment = transactions.find((entry) => entry.holdingId === holding.id && entry.date?.slice(0, 7) === selectedMonthKey)
      setHoldingPaymentAmount(existingPayment ? String(existingPayment.amount) : '')
      setHoldingPaymentFormId(holding.id)
      setHoldingPaymentFormMonth(selectedMonthKey)
      setCloudError('')
      return
    }

    const monthIndex = selectedMonth ?? appDate.getMonth()
    const monthKey = `${selectedYear}-${String(monthIndex + 1).padStart(2, '0')}`
    const date = `${monthKey}-01`
    const existingPayment = transactions.find((entry) => entry.holdingId === holding.id && entry.date?.slice(0, 7) === monthKey)
    const daysInMonth = new Date(selectedYear, monthIndex + 1, 0).getDate()
    const amount = isDaily ? Number(holding.daily_sip) * daysInMonth : Number(holdingPaymentAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setCloudError(isDaily
        ? 'Add a valid daily SIP amount to this holding before marking the month complete.'
        : 'Enter this month’s SIP payment amount.')
      return
    }
    if (isDaily && existingPayment) {
      setCloudError(`The SIP for ${monthNames[monthIndex]} ${selectedYear} is already marked complete.`)
      return
    }
    const draft = {
      id: existingPayment?.id || window.crypto.randomUUID(),
      name: holding.name,
      reason: `${isDaily ? 'Daily SIP' : 'SIP'} payment for ${holding.name}`,
      amount,
      date,
      type: 'Spending',
      category: 'Other spending',
      cardName: '',
      holdingId: holding.id,
    }

    setCloudError('')
    setCloudLoading(true)
    try {
      const row = toMoneyEntryRow(draft, cards, emis, session.user.id)
      const result = existingPayment
        ? await supabase.from('money_entries').update(row).eq('id', existingPayment.id).eq('user_id', session.user.id).select().single()
        : await supabase.from('money_entries').insert(row).select().single()
      const { data, error } = result
      if (error) throw error
      const savedPayment = fromMoneyEntryRow(data, cards)
      setTransactions((current) => existingPayment
        ? current.map((entry) => entry.id === existingPayment.id ? savedPayment : entry)
        : [savedPayment, ...current])
      setHoldingPaymentFormId(null)
      setHoldingPaymentFormMonth('')
      setHoldingPaymentAmount('')
      setNotice(`${isDaily ? `${daysInMonth} daily SIP payments` : 'SIP payment'} for "${holding.name}" added to ${monthNames[monthIndex]} ${selectedYear} spending.`)
      window.setTimeout(() => setNotice(''), 2600)
    } catch (error) {
      setCloudError(`Could not log this SIP payment: ${error.message}`)
    } finally {
      setCloudLoading(false)
    }
  }

  const resetSubscriptionForm = () => {
    setSubscriptionFormOpen(false)
    setSubscriptionName('')
    setSubscriptionAmount('')
    setSubscriptionStartDate('')
    setSubscriptionEndDate('')
    setEditingSubscriptionId(null)
    setSubscriptionError('')
  }

  const editSubscription = (subscription) => {
    setSubscriptionFormOpen(true)
    setSubscriptionName(subscription.name)
    setSubscriptionAmount(String(subscription.amount))
    setSubscriptionStartDate(subscription.start_date)
    setSubscriptionEndDate(subscription.end_date)
    setEditingSubscriptionId(subscription.id)
    setSubscriptionError('')
  }

  const saveSubscription = async (event) => {
    event.preventDefault()
    const name = subscriptionName.trim()
    const amount = Number(subscriptionAmount)
    if (!name || !Number.isFinite(amount) || amount <= 0 || !subscriptionStartDate || !subscriptionEndDate) {
      setSubscriptionError('Enter a name, a valid amount, and both dates.')
      return
    }
    if (subscriptionEndDate < subscriptionStartDate) {
      setSubscriptionError('End date must be on or after the start date.')
      return
    }
    if (!supabase || !session) {
      setSubscriptionError('Sign in to save subscription details.')
      return
    }

    setSubscriptionError('')
    setCloudLoading(true)
    try {
      const values = {
        name,
        amount,
        start_date: subscriptionStartDate,
        end_date: subscriptionEndDate,
      }
      const result = editingSubscriptionId
        ? await supabase.from('subscriptions').update(values).eq('id', editingSubscriptionId).eq('user_id', session.user.id)
          .select('id, name, amount, start_date, end_date, created_at').single()
        : await supabase.from('subscriptions').insert({ ...values, user_id: session.user.id })
          .select('id, name, amount, start_date, end_date, created_at').single()
      if (result.error) throw result.error

      setSubscriptions((current) => editingSubscriptionId
        ? current.map((subscription) => subscription.id === editingSubscriptionId ? result.data : subscription)
        : [result.data, ...current])
      resetSubscriptionForm()
      setNotice(editingSubscriptionId ? 'Subscription updated.' : `Added "${name}" subscription.`)
      window.setTimeout(() => setNotice(''), 2600)
    } catch (error) {
      setSubscriptionError(`Could not save this subscription: ${error.message}`)
    } finally {
      setCloudLoading(false)
    }
  }

  const deleteSubscription = async (subscription) => {
    if (!window.confirm(`Delete "${subscription.name}" subscription details?`)) return
    if (!supabase || !session) {
      setSubscriptionError('Sign in to delete subscription details.')
      return
    }

    setSubscriptionError('')
    setCloudLoading(true)
    try {
      const { error } = await supabase.from('subscriptions').delete()
        .eq('id', subscription.id)
        .eq('user_id', session.user.id)
      if (error) throw error
      setSubscriptions((current) => current.filter((entry) => entry.id !== subscription.id))
      if (editingSubscriptionId === subscription.id) resetSubscriptionForm()
      setNotice(`Deleted "${subscription.name}" subscription.`)
      window.setTimeout(() => setNotice(''), 2600)
    } catch (error) {
      setSubscriptionError(`Could not delete this subscription: ${error.message}`)
    } finally {
      setCloudLoading(false)
    }
  }

  const toggleDay = (index) => {
    setCompletedDays((current) => current.includes(index)
      ? current.filter((day) => day !== index)
      : [...current, index])
  }

  const changePage = (page) => {
    setActivePage(page)
    setMenuOpen(false)
  }

  const normalizedQuery = query.trim().toLowerCase()
  const searchResults = normalizedQuery ? [
    ...trips
      .filter((trip) => `${trip.title} ${trip.trip_date || ''} ${trip.notes || ''}`.toLowerCase().includes(normalizedQuery)
        || ['trip', 'trips', 'memory', 'memories'].includes(normalizedQuery))
      .map((trip) => ({
        key: `trip-${trip.id}`,
        title: trip.title,
        detail: trip.trip_date || 'Trip memory',
        type: 'Trip',
        onSelect: () => {
          changePage('Personal & life')
          setPersonalView('trips')
          openTrip(trip)
        },
      })),
    ...navItems
      .filter((item) => item.id.toLowerCase().includes(normalizedQuery))
      .map((item) => ({
        key: `page-${item.id}`,
        title: item.id,
        detail: 'Open section',
        type: 'Section',
        onSelect: () => changePage(item.id),
      })),
    ...ideas
      .filter((idea) => `${idea.title} ${idea.category} ${idea.note}`.toLowerCase().includes(normalizedQuery))
      .map((idea) => ({
        key: `idea-${idea.id}`,
        title: idea.title,
        detail: idea.category,
        type: 'Idea',
        onSelect: () => changePage('Business exploration'),
      })),
    ...goals
      .filter((goal) => `${goal.title} ${goal.detail} ${goal.category}`.toLowerCase().includes(normalizedQuery))
      .map((goal) => ({
        key: `goal-${goal.title}`,
        title: goal.title,
        detail: goal.category,
        type: 'Goal',
        onSelect: () => {
          if (goal.category === 'Personal & life') {
            changePage('Personal & life')
          } else {
            changePage('Career & skills')
          }
        },
      })),
    ...transactions
      .filter((entry) => `${entry.name} ${entry.reason || ''} ${entry.type} ${entry.category || ''} ${entry.cardName || ''} ${entry.amount || ''}`.toLowerCase().includes(normalizedQuery))
      .map((entry) => ({
        key: `entry-${entry.id}`,
        title: entry.reason || entry.name,
        detail: `${entry.category || entry.type} · ${entry.date}`,
        type: 'Money',
        onSelect: () => {
          changePage('Money')
          if (entry.date) {
            setSelectedYear(Number(entry.date.slice(0, 4)))
            setSelectedMonth(Number(entry.date.slice(5, 7)) - 1)
          }
        },
      })),
    ...cards
      .filter((card) => `${card.name} ${card.bank || ''}`.toLowerCase().includes(normalizedQuery))
      .map((card) => ({
        key: `card-${card.id}`,
        title: card.name,
        detail: `${card.bank || 'Credit card'} · Credit card`,
        type: 'Money',
        onSelect: () => {
          changePage('Money')
          setSelectedYear(appDate.getFullYear())
          setSelectedMonth(appDate.getMonth())
        },
      })),
    ...activeEmis
      .filter((emi) => `${emi.name} ${emi.category || ''}`.toLowerCase().includes(normalizedQuery))
      .map((emi) => ({
        key: `emi-${emi.id}`,
        title: emi.name,
        detail: `${emi.category || 'Monthly commitment'} · EMI`,
        type: 'Money',
        onSelect: () => {
          changePage('Money')
          setSelectedYear(appDate.getFullYear())
          setSelectedMonth(appDate.getMonth())
        },
      })),
  ].slice(0, 8) : []

  const weekday = appDate.toLocaleDateString('en-US', { weekday: 'long' })
  const monthDay = appDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  const greeting = appDate.getHours() < 12 ? 'Good morning' : appDate.getHours() < 18 ? 'Good afternoon' : 'Good evening'
  const formatMoney = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', currencyDisplay: 'symbol', maximumFractionDigits: 0 }).format(amount)
  const dueTomorrowNotifications = getDueTomorrowNotifications(activeEmis, cards, notificationDate)
  const careerGoalItems = goals.filter((goal) => goal.category === 'Career & skills')
  const selectedCareerTopic = careerTopics.find((topic) => topic.id === selectedCareerTopicId) || null
  const careerTopicChildren = (parentId) => careerTopics
    .filter((topic) => topic.goal_title === selectedCareerGoal && topic.parent_id === parentId)
    .sort((left, right) => left.created_at.localeCompare(right.created_at))
  const renderCareerTopicTree = (parentId = null) => {
    const children = careerTopicChildren(parentId)
    if (!children.length) return null

    return <ul className="career-topic-tree">{children.map((topic) => (
      <li key={topic.id}>
        <div className={`career-topic-row ${selectedCareerTopicId === topic.id ? 'career-topic-row-selected' : ''}`}>
          <button type="button" className="career-topic-select" onClick={() => selectCareerTopic(topic)} aria-current={selectedCareerTopicId === topic.id ? 'page' : undefined}>{topic.title}</button>
          <button type="button" className="career-topic-go" onClick={() => selectCareerTopic(topic)}>Go</button>
          <button type="button" className="transaction-delete career-topic-delete" aria-label={`Delete ${topic.title} and its subtopics`} title="Delete topic" disabled={careerTopicSaving} onClick={() => deleteCareerTopic(topic)}><Icon name="trash" size={14} /></button>
        </div>
        {renderCareerTopicTree(topic.id)}
      </li>
    ))}</ul>
  }

  if (!supabaseConfigured || authLoading || !session || authMode === 'recovery') {
    return (
      <main className="auth-page">
        <section className="panel cloud-gate">
          {!supabaseConfigured ? <>
            <span className="cloud-gate-icon"><Icon name="wallet" size={22} /></span>
            <span className="section-kicker">SUPABASE CONNECTION NEEDED</span>
            <h2>Connect your app</h2>
            <p>Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to the project’s <code>.env</code> file, then restart the app.</p>
          </> : authLoading ? <>
            <span className="cloud-gate-icon cloud-loading-icon"><Icon name="clock" size={22} /></span>
            <span className="section-kicker">SECURE APP ACCESS</span>
            <h2>Checking your session</h2>
            <p>Connecting to your account…</p>
          </> : <>
            <span className="cloud-gate-icon"><Icon name="lock" size={22} /></span>
            <span className="section-kicker">YOUR PERSONAL GROWTH SPACE</span>
            <h2>{authMode === 'signin' ? 'Sign in to your app' : authMode === 'signup' ? 'Create your app account' : authMode === 'forgot' ? 'Reset your password' : 'Choose a new password'}</h2>
            <p>{authMode === 'recovery' ? 'Choose a new password to restore access to your account.' : 'This in-app login uses Supabase Auth. Sign in once to access your dashboard and your private finance data.'}</p>
            <form className="auth-form" onSubmit={authMode === 'forgot' ? requestPasswordReset : authMode === 'recovery' ? updatePassword : submitAuth}>
              {authMode !== 'recovery' && <>
                <label htmlFor="auth-email">Email</label>
                <input id="auth-email" type="email" autoComplete="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="you@example.com" required />
              </>}
              {authMode !== 'forgot' && <>
                <label htmlFor="auth-password">{authMode === 'recovery' ? 'New password' : 'Password'}</label>
                <input id="auth-password" type="password" autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'} minLength={6} value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="At least 6 characters" required />
              </>}
              {cloudError && <p className="cloud-error-message" role="alert">{cloudError}</p>}
              {cloudNotice && <p className="cloud-success-message" role="status">{cloudNotice}</p>}
              <button type="submit" className="primary-button">{authMode === 'signin' ? 'Sign in' : authMode === 'signup' ? 'Create account' : authMode === 'forgot' ? 'Send reset link' : 'Update password'}</button>
            </form>
            <div className="auth-links">
              {authMode === 'signin' && <button className="auth-mode-button" onClick={() => { setAuthMode('forgot'); setCloudError(''); setCloudNotice('') }}>Forgot password?</button>}
              {authMode !== 'recovery' && <button className="auth-mode-button" onClick={() => { setAuthMode((mode) => mode === 'signup' ? 'signin' : 'signup'); setCloudError(''); setCloudNotice('') }}>{authMode === 'signup' ? 'Already registered? Sign in' : 'New here? Create an account'}</button>}
              {(authMode === 'forgot' || authMode === 'recovery') && <button className="auth-mode-button" onClick={() => { setAuthMode('signin'); setCloudError(''); setCloudNotice('') }}>Back to sign in</button>}
            </div>
          </>}
        </section>
      </main>
    )
  }

  return (
    <div className="app-shell">
      {menuOpen && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <button className="brand" onClick={() => changePage('Overview')} aria-label="Go to overview">
          <span className="brand-mark"><span /><span /><span /></span>
          <span>daymark<span className="brand-period">.</span></span>
        </button>

        <div className="workspace-switcher">
          <div className="workspace-avatar">S</div>
          <div className="workspace-copy"><strong>My workspace</strong><span>Personal space</span></div>
          <span className="workspace-dots">···</span>
        </div>

        <p className="nav-label">YOUR SPACE</p>
        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <button key={item.id} className={`nav-item ${activePage === item.id ? 'nav-active' : ''}`} onClick={() => changePage(item.id)}>
              <Icon name={item.icon} size={18} />
              <span>{item.id}</span>
              {item.count && <span className="nav-count">{String(ideas.length).padStart(2, '0')}</span>}
            </button>
          ))}
        </nav>

        <p className="nav-label collection-label">YOUR COLLECTIONS <button aria-label="Add collection">+</button></p>
        <button className="collection-item" onClick={() => changePage('Business exploration')}><span className="collection-dot dot-yellow" />Business ideas</button>
        <button className="collection-item" onClick={() => changePage('Career & skills')}><span className="collection-dot dot-blue" />Career & skills</button>
        <button className="collection-item" onClick={() => changePage('Personal & life')}><span className="collection-dot dot-pink" />Personal & life</button>

        <div className="sidebar-tip">
          <span className="tip-spark"><Icon name="spark" size={17} /></span>
          <strong>A little progress<br />adds up.</strong>
          <span>Keep showing up for yourself.</span>
          <div className="tip-decoration"><span /><span /><span /></div>
        </div>
        <div className="profile">
          <div className="profile-avatar">S</div>
          <div className="profile-copy"><strong>Sankalp</strong><span>Free plan</span></div>
          <button className="profile-more" aria-label="Profile options">···</button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu icon-button" onClick={() => setMenuOpen(true)} aria-label="Open navigation"><Icon name="menu" /></button>
          <div className="breadcrumb"><span>My workspace</span><Icon name="chevron" size={14} /><strong>{activePage}</strong></div>
          <div className="topbar-actions">
            <div className="search-container" ref={searchContainerRef}>
              <div className="search-box">
                <Icon name="search" size={17} />
                <input ref={searchInputRef} aria-label="Search this workspace" aria-expanded={searchOpen} aria-controls="workspace-search-results" value={query} onFocus={() => setSearchOpen(true)} onChange={(event) => setQuery(event.target.value)} placeholder="Search anything..." />
                {query && <button type="button" className="search-clear" aria-label="Clear search" onClick={() => { setQuery(''); searchInputRef.current?.focus(); setSearchOpen(true) }}><Icon name="close" size={13} /></button>}
                <kbd>Ctrl K</kbd>
              </div>
              {searchOpen && <div className="search-results" id="workspace-search-results" role="listbox" aria-label="Workspace search results">
                {!normalizedQuery
                  ? <p className="search-empty-hint">Search ideas, goals, trips, payments, cards, or sections.</p>
                  : searchResults.length
                    ? searchResults.map((result) => <button type="button" className="search-result" role="option" aria-selected="false" key={result.key} onClick={() => { result.onSelect(); setQuery(''); setSearchOpen(false); searchInputRef.current?.blur() }}>
                      <span className="search-result-icon"><Icon name={result.type === 'Money' ? 'wallet' : result.type === 'Section' ? 'grid' : result.type === 'Trip' ? 'spark' : result.type === 'Goal' ? 'heart' : 'lightbulb'} size={15} /></span>
                      <span className="search-result-copy"><strong>{result.title}</strong><small>{result.detail}</small></span>
                      <span className="search-result-type">{result.type}</span>
                    </button>)
                    : tripsError ? <div className="search-empty-hint search-trip-error" role="alert">{tripsError}<button type="button" onClick={() => { setTripsError(''); setTripsLoading(true); setTripsReload((count) => count + 1) }}>Retry trip search</button></div>
                      : !tripsLoaded ? <p className="search-empty-hint" role="status">Loading your saved trips and other results…</p>
                    : <p className="search-empty-hint">No matching items. Try another word.</p>}
              </div>}
            </div>
            <div className="notification-container">
              <button type="button" className="icon-button notification-button" aria-label={`Notifications${dueTomorrowNotifications.length ? `, ${dueTomorrowNotifications.length} due tomorrow` : ''}`} aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((open) => !open)}>
                <Icon name="bell" size={18} />
                {dueTomorrowNotifications.length > 0 && <span className="notification-count">{dueTomorrowNotifications.length}</span>}
              </button>
              {notificationsOpen && <section className="notification-popover" aria-label="Notifications">
                <div className="notification-heading"><strong>Notifications</strong><span>{dueTomorrowNotifications.length}</span></div>
                {dueTomorrowNotifications.length
                  ? <ul>{dueTomorrowNotifications.map((item) => <li key={item.id}>
                    <button type="button" onClick={() => { changePage('Money'); setSelectedYear(appDate.getFullYear()); setSelectedMonth(appDate.getMonth()); setNotificationsOpen(false) }}>
                      <span className="notification-item-icon"><Icon name={item.type === 'EMI' ? 'clock' : 'card'} size={15} /></span>
                      <span><strong>{item.title}</strong><small>{item.detail}</small></span>
                    </button>
                  </li>)}</ul>
                  : <p className="notification-empty">No payments are due tomorrow.</p>}
              </section>}
            </div>
            <div className="profile-menu-container" ref={profileContainerRef}>
              <button className="top-avatar" aria-label="Account profile" aria-expanded={profileOpen} onClick={toggleProfile}>
                {(profileUser?.user_metadata?.full_name || profileUser?.email || session.user.email || 'S').charAt(0).toUpperCase()}
              </button>
              {profileOpen && <section className="profile-popover" aria-label="Account details">
                <div className="profile-popover-heading">
                  <span className="profile-popover-avatar">{(profileUser?.user_metadata?.full_name || profileUser?.email || session.user.email || 'S').charAt(0).toUpperCase()}</span>
                  <div><strong>{profileUser?.user_metadata?.full_name || profileUser?.user_metadata?.name || 'Your account'}</strong><span>{profileUser?.email || session.user.email}</span></div>
                </div>
                {profileLoading ? <p className="profile-popover-status" role="status">Loading your Supabase account details…</p>
                  : profileError ? <p className="profile-popover-error" role="alert">{profileError}<button type="button" onClick={loadProfile}>Try again</button></p>
                    : profileUser && <dl className="profile-details">
                      <div><dt>User ID</dt><dd>{profileUser.id}</dd></div>
                      <div><dt>Account created</dt><dd>{profileUser.created_at ? new Date(profileUser.created_at).toLocaleDateString() : 'Not available'}</dd></div>
                      <div><dt>Last sign in</dt><dd>{profileUser.last_sign_in_at ? new Date(profileUser.last_sign_in_at).toLocaleString() : 'Not available'}</dd></div>
                    </dl>}
                <button type="button" className="profile-popover-signout" onClick={signOut}>Sign out</button>
              </section>}
            </div>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div>
              <p className="eyebrow">{weekday.toUpperCase()}, {monthDay.toUpperCase()}</p>
              <h1>{activePage === 'Overview' ? `${greeting}, Sankalp` : activePage}<span className="wave">{activePage === 'Overview' ? ' ✳' : ''}</span></h1>
              <p className="welcome-subtitle">{activePage === 'Overview' ? 'You’re building a life that feels like yours. Keep going.' : pageSubtitle(activePage)}</p>
            </div>
            {activePage !== 'Money' && !(activePage === 'Personal & life' && personalView === 'trips') && <button className="primary-button" onClick={openAddIdea}><Icon name="plus" size={17} /> New idea</button>}
            {activePage === 'Money' && selectedMonth !== null && !cloudDataLoading && !cloudLoadError && <button className="primary-button" onClick={() => openMoneyForm()}><Icon name="plus" size={17} /> Add entry</button>}
          </section>

          {activePage === 'Overview' && <>
          <section className="hero-card">
            <div className="hero-copy">
              <span className="hero-pill"><span /> YOUR WEEKLY CHECK-IN</span>
              <h2>Small steps.<br />Big <em>becoming.</em></h2>
              <p>You’ve made space for the things that matter. Let’s keep that momentum going.</p>
              <button className="hero-link" onClick={() => changePage('Career & skills')}>See your progress <Icon name="arrow" size={16} /></button>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="orbit orbit-one" /><div className="orbit orbit-two" />
              <span className="art-spark art-spark-one">✳</span><span className="art-spark art-spark-two">✦</span>
              <div className="art-sun" />
              <div className="art-hill art-hill-back" />
              <div className="art-hill art-hill-front" />
              <div className="art-path" />
              <div className="art-plant"><span /><span /><span /><i /></div>
              <div className="art-stats"><strong>{loginStreak ?? '…'} <small>days</small></strong><span>daily login streak</span><div className="mini-bars">{Array.from({ length: 5 }, (_, index) => <i key={index} />)}</div></div>
            </div>
            <span className="hero-grain" />
          </section>

          <section className="stats-row" aria-label="Your growth at a glance">
            <article className="stat-card">
              <span className="stat-icon stat-ideas"><Icon name="wallet" size={18} /></span>
              <div><span className="stat-label">INCOME TRACKED</span><strong>{formatMoney(totalIncome)}</strong></div>
              <span className="stat-trend">This month</span>
            </article>
            <article className="stat-card">
              <span className="stat-icon stat-goals"><Icon name="receipt" size={18} /></span>
              <div><span className="stat-label">SPENDING THIS MONTH</span><strong>{formatMoney(totalOutgoings)}</strong></div>
              <span className="stat-trend">Card repayments separate</span>
            </article>
            <article className="stat-card">
              <span className="stat-icon stat-streak"><Icon name="lightbulb" size={18} /></span>
              <div><span className="stat-label">BUSINESS IDEAS</span><strong>{String(ideas.length).padStart(2, '0')} <small>to explore</small></strong></div>
              <span className="stat-trend">{goals.length} goals at a glance</span>
            </article>
          </section>
          {streakError && <p className="cloud-inline-error" role="alert">{streakError}</p>}
          </>}

          {activePage === 'Money' && (cloudDataLoading || cloudLoadError) ? <section className="panel cloud-gate">
            {cloudDataLoading ? <>
              <span className="cloud-gate-icon cloud-loading-icon"><Icon name="clock" size={22} /></span>
              <span className="section-kicker">SECURE CLOUD SYNC</span>
              <h2>Loading your money tracker</h2>
              <p>Your finance records load from your Supabase account.</p>
            </> : <>
              <span className="cloud-gate-icon"><Icon name="close" size={22} /></span>
              <span className="section-kicker">SUPABASE CONNECTION ISSUE</span>
              <h2>Couldn’t load your finance data</h2>
              <p className="cloud-error-message">{cloudLoadError}</p>
              <p>Check that the Data API is enabled, the required finance, holdings, and subscriptions migrations have been applied, and the tables have signed-in-user RLS policies.</p>
              <button className="primary-button" onClick={() => { setCloudLoadError(''); setCloudRefreshCount((count) => count + 1) }}>Retry connection</button>
            </>}
          </section> : activePage === 'Money' && <section className="money-page">
            <div className={`cloud-sync-status ${cloudLoading ? 'cloud-sync-saving' : ''}`} aria-live="polite"><span /> {cloudLoading ? 'Saving to Supabase…' : realtimeStatus === 'connected' ? `Live sync connected · ${session?.user?.email}` : realtimeStatus === 'connecting' ? 'Connecting live sync…' : `Saved to Supabase · ${session?.user?.email}`}</div>
            {cloudError && <p className="cloud-inline-error" role="alert">{cloudError}</p>}
            {localFinanceBackupAvailable && <div className="local-backup-notice"><p>Previous browser-only finance records were preserved on this device. They have not been imported into Supabase.</p><button onClick={downloadLocalFinanceBackup}>Download backup</button></div>}
            <section className="panel year-ledger">
              <div className="year-ledger-heading">
                <div><span className="section-kicker">MONTH-BY-MONTH OVERVIEW</span><h2>Choose a month</h2><p>Select a month box to see income, spending, EMI and card details below.</p></div>
                <div className="year-currency-controls"><span className="currency-badge">CURRENCY · INR ₹</span><label className="year-select-label" htmlFor="money-year">YEAR<select id="money-year" value={selectedYear} onChange={(event) => { setSelectedYear(Number(event.target.value)); setSelectedMonth(null) }}>{availableYears.map((year) => <option key={year} value={year}>{year}</option>)}</select></label></div>
              </div>
              <div className="month-box-grid" aria-label={`${selectedYear} monthly finance overview`}>
                {monthlyTotals.map((month) => <button key={month.name} className={`month-box ${selectedMonth === month.index ? 'month-box-selected' : ''}`} aria-pressed={selectedMonth === month.index} onClick={() => setSelectedMonth(month.index)}>
                  <span className="month-box-name">{month.name}</span>
                  <span className="month-box-total"><small>Income</small><strong>{formatMoney(month.income)}</strong></span>
                  <span className="month-box-total"><small>Spending</small><strong>{formatMoney(month.spending)}</strong></span>
                  <span className={`month-box-net ${month.income - month.spending >= 0 ? 'ledger-positive' : 'ledger-negative'}`}>Net {formatMoney(month.income - month.spending)}</span>
                </button>)}
              </div>
              {selectedMonth === null && <p className="month-selection-hint"><Icon name="arrow" size={14} /> Select any month box to open its entries, EMI payments and card details.</p>}
            </section>

            {selectedMonth !== null && <>
            <div className="money-month-heading"><span className="section-kicker">SELECTED MONTH · INR ₹</span><h2>{monthNames[selectedMonth]} {selectedYear}</h2></div>
            <div className="money-summary-grid">
              <article className="money-summary money-summary-income"><span><Icon name="income" size={18} /></span><div><small>{monthNames[selectedMonth].toUpperCase()} {selectedYear} · INCOME</small><strong>{formatMoney(totalIncome)}</strong><em>{monthTransactions.filter((entry) => entry.type === 'Income').length} income entries</em></div></article>
              <article className="money-summary money-summary-spend"><span><Icon name="expense" size={18} /></span><div><small>{monthNames[selectedMonth].toUpperCase()} {selectedYear} · SPENDING</small><strong>{formatMoney(totalOutgoings)}</strong><em>All payment sources</em></div></article>
              <article className={`money-summary money-summary-balance${remainingMonthlyBalance < 0 ? ' money-summary-balance-negative' : ''}`}><span><Icon name={remainingMonthlyBalance < 0 ? 'expense' : 'income'} size={18} /></span><div><small>REMAINING BALANCE</small><strong>{formatMoney(remainingMonthlyBalance)}</strong><em>Income minus spending</em></div></article>
            </div>

            <div className="money-content-grid">
              <div className="money-left-column">
              <section className="panel money-transactions-panel">
                <div className="section-heading"><div><span className="section-kicker">{monthNames[selectedMonth].toUpperCase()} {selectedYear} · INCOME & SPENDING</span><h2>Monthly entries <span className="heading-count">{monthTransactions.length}</span></h2></div><button className="primary-button money-add-button" onClick={() => openMoneyForm()}><Icon name="plus" size={15} /> Add entry</button></div>
                <div className="money-filter-row">
                  <label htmlFor="money-search"><Icon name="search" size={15} /><input id="money-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search payments and spending" /></label>
                  <span>{monthNames[selectedMonth]} {selectedYear}</span>
                </div>
                <div className="transaction-list">
                  {monthTransactions.filter((entry) => `${entry.name} ${entry.reason || ''} ${entry.type} ${entry.category || ''}`.toLowerCase().includes(query.toLowerCase())).map((entry) => (
                    <article className="transaction-row" key={entry.id}>
                      <span className={`transaction-icon transaction-${entry.type === 'Income' ? 'income' : entry.category === 'Card repayment' || entry.type === 'Card repayment' ? 'repayment' : 'spend'}`}><Icon name={entry.type === 'Income' ? 'income' : entry.category === 'Card repayment' || entry.type === 'Card repayment' ? 'card' : 'expense'} size={17} /></span>
                      <div className="transaction-details"><strong>{entry.reason || entry.name}</strong><span>{entry.type === 'Income' ? entry.name : `${entry.category || (entry.type === 'Card repayment' ? 'Card repayment' : 'Other spending')}${entry.cardName ? ` · ${entry.cardName}` : ''}`}</span></div>
                      <time dateTime={entry.date}>{new Date(`${entry.date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</time>
                      <strong className={`transaction-amount ${entry.type === 'Income' ? 'amount-income' : ''}`}>{entry.type === 'Income' ? '+' : '−'}{formatMoney(Number(entry.amount))}</strong>
                      <button className="transaction-edit" aria-label={`Edit payment: ${entry.reason || entry.name}`} title="Edit payment" onClick={() => openEditTransaction(entry)}><Icon name="edit" size={15} /></button>
                      <button className="transaction-delete" aria-label={`Delete payment: ${entry.reason || entry.name}`} title="Delete payment" onClick={() => deleteTransaction(entry)}><Icon name="trash" size={15} /></button>
                    </article>
                  ))}
                  {monthTransactions.length === 0 && <div className="money-empty"><span><Icon name="receipt" size={22} /></span><strong>No entries for {monthNames[selectedMonth]} {selectedYear}</strong><p>Record income, UPI or cash spending, credit-card payments, card repayments, and EMI payments for this month.</p><button className="primary-button" onClick={() => openMoneyForm()}><Icon name="plus" size={15} /> Add an entry</button></div>}
                </div>
                <div className="money-note"><Icon name="lock" size={14} /> Your entries are stored in Supabase. Other signed-in sessions update live when Realtime is enabled.</div>
              </section>
              <section className="panel commitment-panel completed-emis-panel">
                <div className="section-heading"><div><span className="section-kicker">FINISHED COMMITMENTS</span><h2>Completed EMIs <span className="heading-count">{completedEmis.length}</span></h2></div></div>
                {completedEmis.length > 0
                  ? <div className="completed-emi-list">{completedEmis.map((emi) => {
                    const payments = transactions.filter((entry) => entry.category === 'EMI payment' && (entry.emiId === emi.id || (!entry.emiId && entry.name === emi.name)))
                    const totalPaid = payments.reduce((total, entry) => total + Number(entry.amount), 0)
                    return <article className="completed-emi-row" key={emi.id}>
                      <span className="commitment-icon completed-emi-icon"><Icon name="check" size={16} /></span>
                      <div className="completed-emi-details"><strong>{emi.name}</strong><span>Monthly EMI: <b>{formatMoney(Number(emi.amount))}</b></span><span>Due day: {emi.dueDay || '—'} · Start: {emi.startDate ? new Date(`${emi.startDate}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span><span>End: {emi.endDate ? new Date(`${emi.endDate}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span><span>{payments.length} {payments.length === 1 ? 'payment' : 'payments'} logged · {formatMoney(totalPaid)} paid</span></div>
                      <span className="completed-emi-badge">Completed</span>
                      <button type="button" className="transaction-edit commitment-edit" aria-label={`Edit completed EMI: ${emi.name}`} title="Edit completed EMI" disabled={cloudLoading} onClick={() => openEditCommitment('emi', emi)}><Icon name="edit" size={15} /></button>
                    </article>
                  })}</div>
                  : <p className="commitment-empty">Completed EMIs will appear here. Edit an EMI and mark it as completed to move it to this section.</p>}
              </section>
              <section className="panel commitment-panel holdings-panel">
                <div className="section-heading"><div><span className="section-kicker">INVESTMENTS</span><h2>Holdings and SIP <span className="heading-count">{holdings.length}</span></h2></div>{!holdingFormOpen && <button type="button" className="primary-button subscription-add-button" onClick={() => { resetHoldingForm(); setHoldingFormOpen(true) }} disabled={cloudLoading}><Icon name="plus" size={14} /> Add holding</button>}</div>
                <div className="holding-summary">
                  <div className="holding-total"><span>Total holdings value</span><strong>{formatMoney(totalHoldingsValue)}</strong></div>
                  <div className="holding-total holding-monthly-sip-total"><span>Monthly SIP</span><strong>{formatMoney(totalMonthlySip)}</strong></div>
                  <div className="holding-total emi-sip-total-badge" aria-label={`EMI plus SIP total: ${formatMoney(totalMonthlyEmi + totalMonthlySip)}, including ${formatMoney(totalMonthlyEmi)} EMI and ${formatMoney(totalMonthlySip)} SIP`}>
                    <span>EMI + SIP</span>
                    <strong>{formatMoney(totalMonthlyEmi + totalMonthlySip)}</strong>
                    <small>{formatMoney(totalMonthlyEmi)} EMI + {formatMoney(totalMonthlySip)} SIP</small>
                  </div>
                </div>
                {holdingFormOpen && <form className="subscription-form" onSubmit={saveHolding}>
                  <label htmlFor="holding-name">Stock, fund, or SIP name</label>
                  <input id="holding-name" type="text" maxLength={100} value={holdingName} onChange={(event) => setHoldingName(event.target.value)} placeholder="e.g. Index fund SIP" required disabled={cloudLoading} />
                  <label htmlFor="holding-frequency">SIP frequency</label>
                  <select id="holding-frequency" value={holdingFrequency} onChange={(event) => { setHoldingFrequency(event.target.value); setHoldingSipAmount('') }} disabled={cloudLoading}>
                    <option value="monthly">Monthly</option>
                    <option value="daily">Daily</option>
                  </select>
                  <label htmlFor="holding-sip-amount">{holdingFrequency === 'daily' ? 'Daily SIP amount (₹)' : 'Monthly SIP amount (₹)'}</label>
                  <input id="holding-sip-amount" type="number" min={holdingFrequency === 'daily' ? '0.01' : '0'} step="0.01" value={holdingSipAmount} onChange={(event) => setHoldingSipAmount(event.target.value)} placeholder="0.00" required disabled={cloudLoading} />
                  <label htmlFor="holding-current-value">Current holdings value (₹)</label>
                  <input id="holding-current-value" type="number" min="0" step="0.01" value={holdingCurrentValue} onChange={(event) => setHoldingCurrentValue(event.target.value)} placeholder="0.00" required disabled={cloudLoading} />
                  {holdingError && <p className="subscription-error" role="alert">{holdingError}</p>}
                  <div className="subscription-form-actions">
                    <button className="primary-button" type="submit" disabled={cloudLoading}><Icon name={editingHoldingId ? 'check' : 'plus'} size={14} /> {cloudLoading ? 'Saving…' : editingHoldingId ? 'Save changes' : 'Add holding'}</button>
                    <button className="small-action" type="button" onClick={resetHoldingForm} disabled={cloudLoading}>Cancel</button>
                  </div>
                </form>}
                {holdings.length > 0
                  ? <div className="subscription-list">{holdings.map((holding) => {
                    const holdingPayment = transactions.find((entry) => entry.holdingId === holding.id && entry.date?.slice(0, 7) === selectedMonthKey)
                    const paymentFormOpen = holdingPaymentFormId === holding.id && holdingPaymentFormMonth === selectedMonthKey
                    return <article className="subscription-row holding-row" key={holding.id}>
                    <span className="commitment-icon holding-icon"><Icon name="income" size={16} /></span>
                    <div className="subscription-details">
                      <strong>{holding.name}</strong>
                      <span className={`holding-sip-badge ${holding.sip_frequency === 'daily' ? 'holding-sip-badge-daily' : 'holding-sip-badge-monthly'}`}>{holding.sip_frequency === 'daily' ? `Daily SIP: ${formatMoney(Number(holding.daily_sip))}` : `Monthly SIP: ${formatMoney(Number(holding.monthly_sip))}`}</span>
                      {holding.sip_frequency === 'daily' && <span>{new Date(selectedYear, activeMonthIndex + 1, 0).getDate()} days · Full month: <b>{formatMoney(Number(holding.daily_sip) * new Date(selectedYear, activeMonthIndex + 1, 0).getDate())}</b></span>}
                      <span>Current holdings: <b>{formatMoney(Number(holding.current_value))}</b></span>
                      {holdingPayment && <span>{monthNames[activeMonthIndex]} SIP: <b>{formatMoney(Number(holdingPayment.amount))}</b></span>}
                    </div>
                    {holding.sip_frequency === 'daily'
                      ? <button type="button" className={`small-action holding-payment-button${holdingPayment ? ' payment-logged' : ''}`} onClick={() => logHoldingPayment(holding)} disabled={cloudLoading || Boolean(holdingPayment)}>{holdingPayment ? `${monthNames[activeMonthIndex]} completed` : `Mark ${monthNames[activeMonthIndex]} done`}</button>
                    : <button type="button" className={`small-action holding-payment-button${holdingPayment ? ' payment-logged' : ''}`} onClick={() => logHoldingPayment(holding)} disabled={cloudLoading}>{paymentFormOpen ? 'Save monthly SIP' : holdingPayment ? 'Edit monthly SIP' : 'Log monthly SIP'}</button>}
                    <button type="button" className="transaction-edit commitment-edit" aria-label={`Edit holding: ${holding.name}`} title="Edit holding" disabled={cloudLoading} onClick={() => editHolding(holding)}><Icon name="edit" size={15} /></button>
                    <button type="button" className="transaction-delete commitment-delete" aria-label={`Delete holding: ${holding.name}`} title="Delete holding" disabled={cloudLoading} onClick={() => deleteHolding(holding)}><Icon name="trash" size={15} /></button>
                    {holding.sip_frequency !== 'daily' && paymentFormOpen && <div className="holding-month-payment">
                      <label htmlFor={`holding-payment-${holding.id}`}>{monthNames[activeMonthIndex]} SIP amount (₹)</label>
                      <input id={`holding-payment-${holding.id}`} type="number" min="0.01" step="0.01" value={holdingPaymentAmount} onChange={(event) => setHoldingPaymentAmount(event.target.value)} placeholder="Enter this month’s amount" disabled={cloudLoading} />
                      <button type="button" className="small-action" onClick={() => { setHoldingPaymentFormId(null); setHoldingPaymentFormMonth(''); setHoldingPaymentAmount('') }} disabled={cloudLoading}>Cancel</button>
                    </div>}
                  </article>})}</div>
                  : <p className="commitment-empty">Add a stock or holding to track its monthly SIP and current value.</p>}
                <p className="holding-spending-note">Monthly SIPs are entered separately for each selected month. Daily SIPs are calculated using that month’s exact day count. Logged payments appear in spending, not income.</p>
              </section>
              <section className="panel commitment-panel subscriptions-panel">
                <div className="section-heading"><div><span className="section-kicker">RECURRING SERVICES</span><h2>Subscriptions <span className="heading-count">{subscriptions.length}</span></h2></div>{!subscriptionFormOpen && <button type="button" className="primary-button subscription-add-button" onClick={() => { resetSubscriptionForm(); setSubscriptionFormOpen(true) }} disabled={cloudLoading}><Icon name="plus" size={14} /> Add subscription</button>}</div>
                {subscriptionFormOpen && <form className="subscription-form" onSubmit={saveSubscription}>
                  <label htmlFor="subscription-name">Subscription name</label>
                  <input id="subscription-name" type="text" maxLength={100} value={subscriptionName} onChange={(event) => setSubscriptionName(event.target.value)} placeholder="e.g. Streaming service" required disabled={cloudLoading} />
                  <label htmlFor="subscription-amount">Amount (₹)</label>
                  <input id="subscription-amount" type="number" min="0.01" step="0.01" value={subscriptionAmount} onChange={(event) => setSubscriptionAmount(event.target.value)} placeholder="0.00" required disabled={cloudLoading} />
                  <div className="subscription-date-fields">
                    <div><label htmlFor="subscription-start-date">Start date</label><input id="subscription-start-date" type="date" value={subscriptionStartDate} onChange={(event) => setSubscriptionStartDate(event.target.value)} required disabled={cloudLoading} /></div>
                    <div><label htmlFor="subscription-end-date">End date</label><input id="subscription-end-date" type="date" min={subscriptionStartDate || undefined} value={subscriptionEndDate} onChange={(event) => setSubscriptionEndDate(event.target.value)} required disabled={cloudLoading} /></div>
                  </div>
                  <div className="subscription-form-actions">
                    <button className="primary-button" type="submit" disabled={cloudLoading}><Icon name={editingSubscriptionId ? 'check' : 'plus'} size={14} /> {cloudLoading ? 'Saving…' : editingSubscriptionId ? 'Save changes' : 'Add subscription'}</button>
                    <button className="small-action" type="button" onClick={resetSubscriptionForm} disabled={cloudLoading}>Cancel</button>
                  </div>
                </form>}
                {subscriptionError && <p className="subscription-error" role="alert">{subscriptionError}</p>}
                {subscriptions.length > 0
                  ? <div className="subscription-list">{subscriptions.map((subscription) => <article className="subscription-row" key={subscription.id}>
                    <span className="commitment-icon subscription-icon"><Icon name="clock" size={16} /></span>
                    <div className="subscription-details"><strong>{subscription.name}</strong><span>Start: {new Date(`${subscription.start_date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span><span>End: {new Date(`${subscription.end_date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
                    <strong className="subscription-amount">{formatMoney(Number(subscription.amount))}</strong>
                    <button type="button" className="transaction-edit commitment-edit" aria-label={`Edit subscription: ${subscription.name}`} title="Edit subscription" disabled={cloudLoading} onClick={() => editSubscription(subscription)}><Icon name="edit" size={15} /></button>
                    <button type="button" className="transaction-delete commitment-delete" aria-label={`Delete subscription: ${subscription.name}`} title="Delete subscription" disabled={cloudLoading} onClick={() => deleteSubscription(subscription)}><Icon name="trash" size={15} /></button>
                  </article>)}</div>
                  : <p className="commitment-empty">Add subscriptions to keep their amount and active dates together.</p>}
              </section>
              <section className="panel commitment-panel available-cards-panel">
                <div className="section-heading"><div><span className="section-kicker">AVAILABLE CREDIT CARDS</span><h2>Credit cards available <span className="heading-count">{availableCards.length}</span></h2></div></div>
                <form className="available-card-form" onSubmit={addAvailableCard}>
                  <input aria-label="Available credit card name" maxLength={100} value={availableCardName} onChange={(event) => setAvailableCardName(event.target.value)} placeholder="Enter a card name" required />
                  <button className="primary-button" type="submit" disabled={cloudLoading}><Icon name="plus" size={14} /> Add</button>
                </form>
                {availableCards.length > 0
                  ? <ul className="available-card-list">{availableCards.map((card) => <li key={card.id}><Icon name="card" size={15} /><span>{card.name}</span><button className="transaction-delete available-card-delete" type="button" aria-label={`Remove ${card.name} from available credit cards`} title="Remove card" disabled={cloudLoading} onClick={() => deleteAvailableCard(card)}><Icon name="trash" size={15} /></button></li>)}</ul>
                  : <p className="commitment-empty">Add the names of all your available cards here. This list is separate from cards used for payment tracking.</p>}
              </section>
              </div>

              <div className="commitments-column">
                <section className="panel commitment-panel">
                  <div className="section-heading"><div><span className="section-kicker">MONTHLY COMMITMENTS</span><h2>EMIs <span className="heading-count">{activeEmis.length}</span></h2></div><button className="round-arrow" aria-label="Add EMI" onClick={() => openMoneyForm('emi')}><Icon name="plus" size={16} /></button></div>
                  <div className="commitment-summary" aria-label={`EMI summary for ${monthNames[activeMonthIndex]} ${selectedYear}`}>
                    <div className="commitment-summary-card commitment-summary-total"><span>Total EMI</span><strong>{formatMoney(totalMonthlyEmi)}</strong></div>
                    <div className="commitment-summary-card commitment-summary-paid"><span>Paid · {monthNames[activeMonthIndex]}</span><strong>{formatMoney(totalMonthlyEmiPayments)}</strong></div>
                    <div className="commitment-summary-card commitment-summary-remaining"><span>Remaining</span><strong>{formatMoney(remainingMonthlyEmi)}</strong></div>
                  </div>
                  {activeEmis.map((emi) => {
                    const payments = monthTransactions.filter((entry) => entry.category === 'EMI payment' && (entry.emiId === emi.id || (!entry.emiId && entry.name === emi.name)))
                    return <article className="commitment-item" key={emi.id}>
                      <div className="commitment-row"><span className="commitment-icon commitment-emi"><Icon name="clock" size={16} /></span><div><strong>{emi.name}</strong><span>Due day {emi.dueDay || '—'}</span><span className="emi-date-line">Start: {emi.startDate ? new Date(`${emi.startDate}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span><span className="emi-date-line">End: {emi.endDate ? new Date(`${emi.endDate}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span><strong className="commitment-amount"><small>MONTHLY</small>{formatMoney(Number(emi.amount))}</strong></div><button className={`small-action${payments.length ? ' payment-logged' : ''}`} onClick={() => recordCommitmentPayment('EMI payment', emi)}>{payments.length ? 'Log another payment' : 'Log payment'}</button><button type="button" className="transaction-edit commitment-edit" aria-label={`Edit EMI: ${emi.name}`} title="Edit EMI" disabled={cloudLoading} onClick={() => openEditCommitment('emi', emi)}><Icon name="edit" size={15} /></button><button type="button" className="transaction-delete commitment-delete" aria-label={`Delete monthly commitment: ${emi.name}`} title="Delete monthly commitment" disabled={cloudLoading} onClick={() => deleteEmi(emi)}><Icon name="trash" size={15} /></button></div>
                      {payments.length > 0 && <div className="commitment-activity">{payments.map((payment) => <span key={payment.id}><Icon name="check" size={12} /> Paid <strong>{formatMoney(Number(payment.amount))}</strong> on {new Date(`${payment.date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>)}</div>}
                    </article>
                  })}
                  {activeEmis.length === 0 && <p className="commitment-empty">Add each current EMI with its monthly amount and due day to see all your commitments here.</p>}
                  <button className="commitment-add" onClick={() => openMoneyForm('emi')}><Icon name="plus" size={14} /> Add current EMI</button>
                </section>
                  <section className="panel commitment-panel chit-fund-panel">
                    <div className="section-heading"><div><span className="section-kicker">MONTHLY CONTRIBUTIONS</span><h2>Chit fund <span className="heading-count">{chitFunds.length}</span></h2></div>{!chitFundFormOpen && <button type="button" className="primary-button subscription-add-button" onClick={() => { setChitFundError(''); setChitFundFormOpen(true) }} disabled={cloudLoading}><Icon name="plus" size={14} /> Add</button>}</div>
                    <div className="chit-fund-current-total"><span>Current holding</span><strong>{formatMoney(totalChitFundHolding)}</strong></div>
                    {chitFundFormOpen && <form className="subscription-form chit-fund-form" onSubmit={saveChitFund}>
                      <label htmlFor="chit-fund-name">Chit fund name</label>
                      <input id="chit-fund-name" type="text" maxLength={100} value={chitFundName} onChange={(event) => setChitFundName(event.target.value)} placeholder="Enter chit fund name" required disabled={cloudLoading} />
                      <label htmlFor="chit-fund-amount">Monthly amount (₹)</label>
                      <input id="chit-fund-amount" type="number" min="0.01" step="0.01" value={chitFundMonthlyAmount} onChange={(event) => setChitFundMonthlyAmount(event.target.value)} placeholder="0.00" required disabled={cloudLoading} />
                      <div className="subscription-date-fields">
                        <div><label htmlFor="chit-fund-start-date">Start date</label><input id="chit-fund-start-date" type="date" value={chitFundStartDate} onChange={(event) => setChitFundStartDate(event.target.value)} required disabled={cloudLoading} /></div>
                        <div><label htmlFor="chit-fund-end-date">End date</label><input id="chit-fund-end-date" type="date" min={chitFundStartDate || undefined} value={chitFundEndDate} onChange={(event) => setChitFundEndDate(event.target.value)} required disabled={cloudLoading} /></div>
                      </div>
                      {chitFundError && <p className="subscription-error" role="alert">{chitFundError}</p>}
                      <div className="subscription-form-actions">
                        <button className="primary-button" type="submit" disabled={cloudLoading}><Icon name={editingChitFundId ? 'check' : 'plus'} size={14} /> {cloudLoading ? 'Saving…' : editingChitFundId ? 'Save changes' : 'Add chit fund'}</button>
                        <button className="small-action" type="button" onClick={resetChitFundForm} disabled={cloudLoading}>Cancel</button>
                      </div>
                    </form>}
                    {chitFundError && !chitFundFormOpen && <p className="subscription-error" role="alert">{chitFundError}</p>}
                    {chitFunds.length > 0
                      ? <div className="chit-fund-list">{chitFunds.map((chitFund) => {
                        const months = getMonthsInRange(chitFund.startDate, chitFund.endDate)
                        const paymentsByMonth = new Map(chitFund.paidMonths.map((payment) => [payment.month, payment]))
                        const paidCount = months.filter((month) => paymentsByMonth.has(month.key)).length
                        const remainingCount = months.length - paidCount
                        const currentHolding = paidCount * chitFund.monthlyAmount
                        return <article className="chit-fund-item" key={chitFund.id}>
                          <div className="chit-fund-heading">
                            <div><strong>{chitFund.name}</strong><span>{formatMoney(chitFund.monthlyAmount)} per month · {chitFund.startDate} – {chitFund.endDate}</span></div>
                            <div className="chit-fund-actions">
                              <button type="button" className="transaction-edit commitment-edit" aria-label={`Edit chit fund: ${chitFund.name}`} title="Edit chit fund" disabled={cloudLoading} onClick={() => editChitFund(chitFund)}><Icon name="edit" size={15} /></button>
                              <button type="button" className="transaction-delete commitment-delete" aria-label={`Delete chit fund: ${chitFund.name}`} title="Delete chit fund" disabled={cloudLoading} onClick={() => deleteChitFund(chitFund)}><Icon name="trash" size={15} /></button>
                            </div>
                          </div>
                          <div className="chit-fund-stats">
                            <span>Current holding <b>{formatMoney(currentHolding)}</b></span>
                            <span>Paid <b>{paidCount} / {months.length} months</b></span>
                            <span>Remaining <b>{remainingCount} {remainingCount === 1 ? 'month' : 'months'}</b></span>
                          </div>
                          <details className="chit-months-accordion">
                            <summary><span>Monthly payments</span><strong>{paidCount} of {months.length} paid</strong></summary>
                            <div className="chit-month-list">
                              {months.map((month) => {
                                const payment = paymentsByMonth.get(month.key)
                                const transactionInputId = `chit-transaction-${chitFund.id}-${month.key}`
                                return <div className={`chit-month-row${payment ? ' chit-month-paid' : ''}`} key={month.key}>
                                  <span className="chit-month-name">{month.label}</span>
                                  {payment
                                    ? <span className="chit-month-payment">{payment.transactionId ? `Transaction ID: ${payment.transactionId}` : 'Payment recorded'} · Added to spending</span>
                                    : <label className="chit-transaction-field" htmlFor={transactionInputId}><span>Transaction ID (optional)</span><input id={transactionInputId} type="text" maxLength={100} value={chitTransactionIds[`${chitFund.id}:${month.key}`] || ''} onChange={(event) => setChitTransactionIds((current) => ({ ...current, [`${chitFund.id}:${month.key}`]: event.target.value }))} placeholder="Optional" disabled={cloudLoading} /></label>}
                                  <button type="button" className={`small-action chit-month-button${payment ? ' payment-logged' : ''}`} onClick={() => toggleChitFundMonth(chitFund, month.key)} disabled={cloudLoading}>{payment ? 'Mark unpaid' : 'Mark paid'}</button>
                                </div>
                              })}
                            </div>
                          </details>
                        </article>
                      })}</div>
                      : <p className="commitment-empty">Add a chit fund to track its monthly payments and remaining months.</p>}
                  </section>
              </div>
            </div>
            </>}
          </section>}

          {activePage === 'Personal & life' && personalView === 'goals' && <button type="button" className="panel trips-entry-panel" onClick={openTrips}>
            <div><span className="section-kicker">MEMORIES TO KEEP</span><h2>Your trips</h2><p>Save a little note and the photos and videos you want to remember.</p></div>
            <span className="primary-button"><Icon name="arrow" size={16} /> Open trips</span>
          </button>}

          {activePage === 'Career & skills' && !selectedCareerGoal && <section className="panel focus-panel">
            <div className="section-heading"><div><span className="section-kicker">YOUR GOALS, AT YOUR PACE</span><h2>Career & skills</h2></div><span className="week-label">{careerGoalItems.length} TOPICS</span></div>
            <p className="focus-intro">Choose a learning area to open its workspace. Add topics, nest subtopics, and keep notes for each one.</p>
            <div className="focus-goals">
              {careerGoalItems.map((goal) => <button type="button" className="focus-goal-card career-goal-card" key={goal.title} onClick={() => openCareerGoal(goal)}>
                <span className={`focus-goal-icon progress-${goal.color}`}><Icon name="book" size={19} /></span>
                <span className="focus-goal-content">
                  <span className="section-kicker">{goal.category.toUpperCase()}</span>
                  <strong>{goal.title}</strong>
                  <span>{goal.detail}</span>
                </span>
                <span className="primary-button career-goal-open"><Icon name="arrow" size={15} /> Go</span>
              </button>)}
            </div>
          </section>}

          {activePage === 'Career & skills' && selectedCareerGoal && <section className="career-workspace">
            <header className="panel career-workspace-header">
              <button type="button" className="trips-back-button" onClick={closeCareerGoal}><Icon name="arrow" size={15} /> Back to Career & skills</button>
              <span className="section-kicker">LEARNING WORKSPACE</span>
              <h2>{selectedCareerGoal}</h2>
            </header>
            {careerTopicsError && <p className="cloud-inline-error" role="alert">{careerTopicsError}<button type="button" className="business-note-retry" onClick={() => { setCareerTopicsError(''); setCareerTopicsLoading(true); setCareerTopicsReload((count) => count + 1) }}>Try again</button></p>}
            <div className="career-workspace-grid">
              <aside className="panel career-topic-sidebar">
                <div className="section-heading"><div><span className="section-kicker">YOUR LEARNING PATH</span><h2>Subtopics <span className="heading-count">{careerTopics.filter((topic) => topic.goal_title === selectedCareerGoal).length}</span></h2></div></div>
                <button type="button" className={`career-all-topics ${selectedCareerTopicId ? '' : 'career-all-topics-selected'}`} onClick={showAllCareerTopics}>All topics in this goal</button>
                {careerTopicsLoading
                  ? <div className="business-note-status" role="status">Loading your topics…</div>
                  : careerGoalItems.length > 0 && renderCareerTopicTree()}
                {!careerTopicsLoading && careerTopics.length === 0 && !careerTopicsError && <p className="career-topics-empty">No topics yet. Add your first topic below.</p>}
                <form className="career-topic-add-form" onSubmit={addCareerTopic}>
                  <label htmlFor="career-topic-title">{selectedCareerTopic ? `Add a subtopic under “${selectedCareerTopic.title}”` : 'Add a topic under this goal'}</label>
                  <input id="career-topic-title" maxLength={100} value={newCareerTopicTitle} onChange={(event) => setNewCareerTopicTitle(event.target.value)} placeholder={selectedCareerTopic ? 'Enter a subtopic' : 'Enter a topic'} required disabled={careerTopicSaving} />
                  <button type="submit" className="primary-button" disabled={careerTopicSaving}><Icon name="plus" size={15} /> {careerTopicSaving ? 'Adding…' : 'Add topic'}</button>
                </form>
              </aside>
              <section className="panel career-topic-detail">
                {selectedCareerTopic ? <>
                  <div className="section-heading">
                    <div><span className="section-kicker">{selectedCareerTopic.parent_id ? 'SUBTOPIC' : 'TOPIC'}</span><h2>{selectedCareerTopic.title}</h2></div>
                    <button type="button" className="transaction-delete" aria-label={`Delete ${selectedCareerTopic.title} and its subtopics`} title="Delete topic" disabled={careerTopicSaving} onClick={() => deleteCareerTopic(selectedCareerTopic)}><Icon name="trash" size={16} /></button>
                  </div>
                  <form className="career-notes-form" onSubmit={saveCareerTopicNotes}>
                    <label htmlFor="career-topic-notes">Notes</label>
                    <textarea id="career-topic-notes" value={careerTopicNotes} onChange={(event) => setCareerTopicNotes(event.target.value)} placeholder={`Write notes for ${selectedCareerTopic.title}…`} rows={13} maxLength={50000} disabled={careerTopicSaving} />
                    <button type="submit" className="primary-button" disabled={careerTopicSaving}><Icon name="check" size={15} /> {careerTopicSaving ? 'Saving…' : 'Save notes'}</button>
                  </form>
                  <div className="career-child-topics">
                    <div className="section-heading"><div><span className="section-kicker">GO DEEPER</span><h2>Sub-subtopics</h2></div></div>
                    {careerTopicChildren(selectedCareerTopic.id).length > 0
                      ? <div className="career-child-topic-list">{careerTopicChildren(selectedCareerTopic.id).map((topic) => <button type="button" className="career-child-topic" key={topic.id} onClick={() => selectCareerTopic(topic)}><span><Icon name="book" size={16} />{topic.title}</span><span className="career-child-go">Go <Icon name="arrow" size={13} /></span></button>)}</div>
                      : <p className="career-topics-empty">No subtopics yet. Add one from the left pane.</p>}
                  </div>
                </> : <div className="career-topic-welcome">
                  <span className="career-topic-welcome-icon"><Icon name="book" size={22} /></span>
                  <h2>Choose a subtopic</h2>
                  <p>Select a topic from the left pane to open its notes and add sub-subtopics.</p>
                </div>}
              </section>
            </div>
          </section>}

          {activePage === 'Personal & life' && personalView === 'goals' && <section className="panel focus-panel">
            <div className="section-heading"><div><span className="section-kicker">YOUR GOALS, AT YOUR PACE</span><h2>Personal & life goals</h2></div><span className="week-label">{goals.filter((goal) => goal.category === activePage).length} GOALS</span></div>
            <p className="focus-intro">Personal milestones deserve space too. Open each goal to save private notes and images, and work through it at your own pace.</p>
            <div className="focus-goals">
              {goals.filter((goal) => goal.category === activePage).map((goal) => <article className="focus-goal-card personal-goal-card" key={goal.title} onClick={() => openPersonalGoalNotes(goal)} onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  openPersonalGoalNotes(goal)
                }
              }} role="button" tabIndex={0} aria-label={`Open notes for ${goal.title}`}>
                <span className={`focus-goal-icon progress-${goal.color}`}><Icon name="heart" size={19} /></span>
                <div className="focus-goal-content"><span className="section-kicker">{goal.category.toUpperCase()}</span><h3>{goal.title}</h3><p>{goal.detail}</p></div>
                <span className="notes-button progress-button"><Icon name="journal" size={15} /> Open notes</span>
              </article>)}
            </div>
          </section>}

          {activePage === 'Personal & life' && personalView === 'trips' && <section className="panel trips-panel">
            {selectedTrip ? <>
              <div className="section-heading trips-heading">
                <div>
                  <button className="trips-back-button" onClick={closeTrip}><Icon name="arrow" size={15} /> Back to trips</button>
                  <span className="section-kicker">A TRIP TO REMEMBER</span>
                  <h2>{selectedTrip.title}</h2>
                </div>
                <button type="button" className="transaction-delete" aria-label={`Delete trip: ${selectedTrip.title}`} title="Delete trip" disabled={deletingTripIds.includes(selectedTrip.id)} onClick={() => deleteTrip(selectedTrip)}><Icon name="trash" size={16} /></button>
              </div>
              <form className="trip-detail-form" onSubmit={saveTrip}>
                <label htmlFor="trip-name">Trip name</label>
                <input id="trip-name" type="text" maxLength={100} value={tripTitle} onChange={(event) => { setTripTitle(event.target.value); setTripMediaError('') }} required disabled={tripSaving} />
                <label htmlFor="trip-date">Trip date</label>
                <input id="trip-date" type="text" maxLength={100} value={tripDate} onChange={(event) => setTripDate(event.target.value)} placeholder="e.g. 12–15 June 2026 or Summer 2026" disabled={tripSaving} />
                <label htmlFor="trip-notes">A little note</label>
                <textarea id="trip-notes" value={tripNotes} onChange={(event) => setTripNotes(event.target.value)} placeholder="A short note or favorite memory…" rows={3} maxLength={1000} disabled={tripSaving} />
                <label htmlFor="trip-media">Photos & videos <span>PHOTOS UP TO 10 MB · VIDEOS UP TO 50 MB</span></label>
                <input id="trip-media" className="trip-media-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" multiple onChange={selectTripMedia} disabled={tripSaving || tripMediaPaths.length + tripMediaFiles.length >= maxTripMedia} />
                {tripMediaError && <p className="trip-error" role="alert">{tripMediaError}<button type="button" className="business-note-retry" onClick={() => { setTripMediaError(''); setTripMediaLoading(true); setTripMediaReload((count) => count + 1) }}>Try again</button></p>}
                {tripMediaLoading && <div className="business-note-status" role="status">Loading trip memories…</div>}
                {!tripMediaLoading && !tripMediaError && tripCarouselItems.length > 0 && <div className={`trip-carousel-view ${tripCarouselExpanded ? 'trip-carousel-view-expanded' : ''}`}>
                  <div className="trip-carousel-toolbar">
                    <span>{tripCarouselItems[tripCarouselIndex]?.name || `Memory ${tripCarouselIndex + 1} of ${tripCarouselItems.length}`}</span>
                    <button type="button" className="trip-carousel-expand" onClick={() => setTripCarouselExpanded((expanded) => !expanded)}><Icon name={tripCarouselExpanded ? 'minimize' : 'maximize'} size={15} /> {tripCarouselExpanded ? 'Minimize' : 'Maximize'}</button>
                  </div>
                  <div className="trip-carousel" aria-label="Trip memories carousel">
                  {tripCarouselItems[tripCarouselIndex]?.type.startsWith('video/')
                    ? <video key={tripCarouselItems[tripCarouselIndex].url} src={tripCarouselItems[tripCarouselIndex].url} controls preload="metadata" />
                    : <img key={tripCarouselItems[tripCarouselIndex].url} src={tripCarouselItems[tripCarouselIndex].url} alt={tripCarouselItems[tripCarouselIndex]?.name || `Memory ${tripCarouselIndex + 1} from ${selectedTrip.title}`} />}
                  {tripCarouselItems.length > 1 && <>
                    <button type="button" className="trip-carousel-control trip-carousel-previous" aria-label="Previous memory" onClick={() => setTripCarouselIndex((index) => (index - 1 + tripCarouselItems.length) % tripCarouselItems.length)}><Icon name="chevron" size={19} /></button>
                    <button type="button" className="trip-carousel-control trip-carousel-next" aria-label="Next memory" onClick={() => setTripCarouselIndex((index) => (index + 1) % tripCarouselItems.length)}><Icon name="chevron" size={19} /></button>
                    <span className="trip-carousel-count">{tripCarouselIndex + 1} / {tripCarouselItems.length}</span>
                  </>}
                  {tripCarouselItems[tripCarouselIndex]?.local
                    ? <button type="button" className="trip-memory-remove" aria-label="Remove selected memory" disabled={tripSaving} onClick={() => { const item = tripCarouselItems[tripCarouselIndex]; URL.revokeObjectURL(item.previewUrl); setTripMediaFiles((current) => current.filter((file) => file.previewUrl !== item.previewUrl)); setTripCarouselIndex(0) }}><Icon name="trash" size={15} /></button>
                    : <button type="button" className="trip-memory-remove" aria-label="Remove selected memory" disabled={tripSaving} onClick={() => removeTripMemory(tripCarouselItems[tripCarouselIndex].path)}><Icon name="trash" size={15} /></button>}
                  {tripCarouselItems.length > 1 && <div className="trip-carousel-dots">{tripCarouselItems.map((item, index) => <button type="button" key={item.path || item.previewUrl} className={index === tripCarouselIndex ? 'trip-carousel-dot trip-carousel-dot-active' : 'trip-carousel-dot'} aria-label={`Show memory ${index + 1}`} onClick={() => setTripCarouselIndex(index)} />)}</div>}
                  </div>
                </div>}
                {!tripMediaLoading && !tripMediaError && tripCarouselItems.length === 0 && <p className="trip-empty-media">Add photos or videos to see your trip memories here.</p>}
                <button type="submit" className="primary-button trip-save-button" disabled={tripSaving}><Icon name="check" size={16} /> {tripSaving ? 'Saving trip…' : 'Save changes'}</button>
              </form>
            </> : <>
              <div className="section-heading trips-heading">
                <div>
                  <button className="trips-back-button" onClick={() => setPersonalView('goals')}><Icon name="arrow" size={15} /> Back to Personal & life</button>
                  <span className="section-kicker">MEMORIES TO KEEP</span>
                  <h2>Trips <span className="heading-count">{trips.length}</span></h2>
                </div>
                <button className="primary-button" onClick={() => { setNewTripTitle(''); setNewTripDate(''); setTripsError(''); setAddTripOpen(true) }}><Icon name="plus" size={16} /> Add trip</button>
              </div>
              {tripsError && <p className="trip-error" role="alert">{tripsError}<button type="button" className="business-note-retry" onClick={() => { setTripsError(''); setTripsLoading(true); setTripsReload((count) => count + 1) }}>Try again</button></p>}
              {tripsLoading ? <div className="business-note-status" role="status">Loading your trips…</div> : trips.length > 0
                ? <div className="trip-list">{trips.map((trip) => <div className="trip-list-item" key={trip.id}>
                  <button type="button" className="trip-list-card" onClick={() => openTrip(trip)}>
                    <span className="trip-list-icon"><Icon name="journal" size={18} /></span>
                    <span className="trip-list-copy"><strong>{trip.title}</strong><span>{trip.trip_date || trip.notes || `${Array.isArray(trip.media) ? trip.media.length : 0} photos or videos`}</span></span>
                    <Icon name="chevron" size={18} />
                  </button>
                  <button type="button" className="transaction-delete trip-delete-button" aria-label={`Delete trip: ${trip.title}`} title="Delete trip" disabled={deletingTripIds.includes(trip.id)} onClick={() => deleteTrip(trip)}><Icon name="trash" size={15} /></button>
                </div>)}</div>
                : <div className="trip-empty-state"><span className="trip-list-icon"><Icon name="journal" size={20} /></span><strong>No trips yet</strong><p>Add a trip to start collecting your notes, photos, and videos.</p><button className="primary-button" onClick={() => { setNewTripTitle(''); setNewTripDate(''); setAddTripOpen(true) }}><Icon name="plus" size={15} /> Add your first trip</button></div>}
            </>}
          </section>}

          {activePage === 'Business exploration' && <section className="panel business-panel">
            <div className="section-heading"><div><span className="section-kicker">YOUR BUSINESS EXPLORATION</span><h2>Ideas to investigate <span className="heading-count">{ideas.length}</span></h2></div><button className="primary-button money-add-button" onClick={openAddIdea}><Icon name="plus" size={15} /> New business idea</button></div>
            <p className="focus-intro">Choose an idea to open its private R&D notes. Capture research, questions, points to explore, and supporting images in one place.</p>
            <div className="business-idea-grid">{visibleIdeas.map((idea) => <article className="business-idea-card" key={idea.id || `${idea.title}-${idea.note}`}><button type="button" className="business-idea-open-card" onClick={() => openIdeaNotes(idea)} aria-label={`Open notes for ${idea.title}`}><div className={`idea-icon idea-${idea.color}`}><Icon name={idea.icon} size={19} /></div><div className="business-idea-heading"><h3>{idea.title}</h3><span className="stage">{idea.stage}</span></div><p>{idea.note}</p><span className="business-idea-open">Open research notes <Icon name="arrow" size={13} /></span></button><button type="button" className="transaction-delete business-idea-delete" aria-label={`Delete idea: ${idea.title}`} title="Delete idea" disabled={deletingIdeaIds.includes(idea.id)} onClick={() => deleteIdea(idea)}><Icon name="trash" size={15} /></button></article>)}
              {visibleIdeas.length === 0 && <div className="empty-state"><Icon name="search" size={22} /><strong>No business ideas found</strong><span>Try another search, or capture a fresh thought.</span></div>}
            </div>
          </section>}

          {activePage === 'Overview' && <div className="content-grid">
            <section className="panel ideas-panel">
              <div className="section-heading">
                <div><span className="section-kicker">BUSINESS IDEAS TO EXPLORE</span><h2>Your idea garden <span className="heading-count">{String(ideas.length).padStart(2, '0')}</span></h2></div>
                <button className="text-link" onClick={() => changePage('Business exploration')}>View all <Icon name="arrow" size={15} /></button>
              </div>
              <div className="ideas-list">
                {visibleIdeas.slice(0, 3).map((idea) => (
                <article className="idea-row" key={idea.id || `${idea.title}-${idea.note}`}>
                <button type="button" className="idea-row-open" onClick={() => openIdeaNotes(idea)} aria-label={`Open notes for ${idea.title}`}>
                  <div className={`idea-icon idea-${idea.color}`}><Icon name={idea.icon} size={19} /></div>
                  <div className="idea-copy"><div className="idea-title-line"><h3>{idea.title}</h3><span className="stage">{idea.stage}</span></div><p>{idea.note}</p><div className="idea-meta"><span>{idea.category}</span></div></div>
                  <span className="idea-open"><Icon name="chevron" size={17} /></span>
                </button>
                </article>
                ))}
                {visibleIdeas.length === 0 && <div className="empty-state"><Icon name="search" size={22} /><strong>No ideas found</strong><span>Try another search, or capture a fresh thought.</span></div>}
              </div>
              <button className="add-idea-row" onClick={openAddIdea}><span><Icon name="plus" size={16} /></span> Capture a new business idea <kbd>↵</kbd></button>
            </section>

            <section className="panel goals-panel">
              <div className="section-heading">
                <div><span className="section-kicker">CAREER & PERSONAL</span><h2>Your goals in motion</h2></div>
              </div>
              <div className="goals-list">
                {goals.map((goal) => (
                  <article className="goal-row" key={goal.title}>
                    <button className="goal-open-button" onClick={() => goal.category === 'Career & skills' ? openCareerGoal(goal) : openPersonalGoalNotes(goal)} aria-label={`Go to ${goal.title}`}>Go <Icon name="arrow" size={13} /></button>
                    <div className="goal-main"><div className="goal-title-row"><h3>{goal.title}</h3></div><p>{goal.category}</p></div>
                  </article>
                ))}
              </div>
              <button className="goal-footer" onClick={() => changePage('Career & skills')}>View career goals <Icon name="arrow" size={15} /></button>
            </section>

            <section className="panel habit-panel">
              <div className="section-heading">
                <div><span className="section-kicker">MONEY, MADE CLEARER</span><h2>Payments & spending</h2></div>
                <button className="round-arrow" aria-label="Open money tracker" onClick={() => changePage('Money')}><Icon name="arrow" size={16} /></button>
              </div>
              <div className="money-overview"><div><span>Income this month</span><strong>{formatMoney(totalIncome)}</strong></div><div><span>Spending this month</span><strong>{formatMoney(totalOutgoings)}</strong></div></div>
              <button className="goal-footer" onClick={() => changePage('Money')}>Open money tracker <Icon name="arrow" size={15} /></button>
            </section>

            <section className="panel prompt-panel">
              <div className="prompt-icon"><Icon name="journal" size={19} /></div>
              <span className="section-kicker">PERSONAL & LIFE</span>
              <h2>Home remodeling and marriage, at your own pace.</h2>
              <p>Your life goals matter just as much as your career goals.</p>
              <button className="prompt-button" onClick={() => changePage('Personal & life')}>View personal goals <Icon name="arrow" size={15} /></button>
              <div className="prompt-scribble" aria-hidden="true">✳</div>
            </section>
          </div>}
          {activePage === 'Journal' && <section className="panel focus-panel"><div className="section-heading"><div><span className="section-kicker">A MOMENT FOR YOU</span><h2>Personal reflections</h2></div></div><p className="focus-intro">Capture what you learned, what’s on your mind, or a moment you want to remember.</p><textarea className="journal-input" placeholder="Start with: Lately, I’ve been thinking about…" rows={7} /></section>}
          {activePage === 'Habits' && <section className="panel focus-panel"><div className="section-heading"><div><span className="section-kicker">SMALL STEPS, REPEATED</span><h2>Your weekly check-in</h2></div><span className="week-label">{completedDays.length} / 7 DAYS</span></div><p className="focus-intro">Check off the days you made time for yourself. This tracker is saved in this browser.</p><div className="week-days habit-days-large">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => <button key={`${day}-${index}`} className={`day-column ${completedDays.includes(index) ? 'day-done' : ''}`} onClick={() => toggleDay(index)} aria-label={`${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][index]} ${completedDays.includes(index) ? 'completed' : 'not completed'}`}><span>{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][index]}</span><i>{completedDays.includes(index) && <Icon name="check" size={13} />}</i></button>)}</div></section>}
          <footer className="page-footer"><span>Made for the life you’re growing into.</span><span><Icon name="spark" size={13} /> One day at a time</span></footer>
        </div>
      </main>

      {notice && <div className="toast" role="status"><span><Icon name="check" size={15} /></span>{notice}<button onClick={() => setNotice('')} aria-label="Dismiss notification"><Icon name="close" size={14} /></button></div>}
      {modalOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false) }}>
        <form className="idea-modal" onSubmit={addIdea}>
          <button type="button" className="modal-close" onClick={() => setModalOpen(false)} aria-label="Close"><Icon name="close" size={18} /></button>
          <div className="modal-mark"><Icon name="spark" size={21} /></div>
          <span className="section-kicker">SAVE THAT SPARK</span>
          <h2>Every big thing starts somewhere.</h2>
          <p>Get the thought out of your head. You can figure out the details later.</p>
          <label htmlFor="idea-title">The idea</label>
          <input id="idea-title" autoFocus maxLength={100} value={ideaTitle} onChange={(event) => setIdeaTitle(event.target.value)} placeholder="What are you thinking about?" required />
          <label htmlFor="idea-note">A little more about it <span>OPTIONAL</span></label>
          <textarea id="idea-note" maxLength={240} value={ideaNote} onChange={(event) => setIdeaNote(event.target.value)} placeholder="Add a note, question, or first next step..." rows={3} />
          <button type="submit" className="primary-button modal-submit"><Icon name="plus" size={16} /> Save this idea</button>
        </form>
      </div>}
      {selectedIdea && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !businessNoteSaving) closeIdeaNotes() }}>
        <form className="idea-modal business-note-modal" onSubmit={saveBusinessNote}>
          <button type="button" className="modal-close" onClick={closeIdeaNotes} aria-label="Close notes" disabled={businessNoteSaving}><Icon name="close" size={18} /></button>
          <div className="modal-mark"><Icon name="journal" size={21} /></div>
          <span className="section-kicker">{selectedNoteType === 'business' ? 'BUSINESS R&D NOTES' : 'PERSONAL & LIFE NOTES'}</span>
          <h2>{selectedIdea.title}</h2>
          <p>{selectedNoteType === 'business' ? 'Keep research, ideas, questions, and useful points for this opportunity together.' : 'Keep your reflections, plans, ideas, and useful points for this personal goal together.'} Notes and images are saved to your private account.</p>
          {businessNoteLoading ? <div className="business-note-status" role="status">Loading your saved notes…</div> : businessNoteLoadError && <div className="business-note-error" role="alert">{businessNoteLoadError}<button type="button" className="business-note-retry" onClick={() => { setBusinessNoteLoadError(''); setBusinessNoteLoading(true); setBusinessNoteReload((count) => count + 1) }}>Try again</button></div>}
          {!businessNoteLoading && !businessNoteLoadError && <>
            {businessNoteError && <p className="business-note-error" role="alert">{businessNoteError}</p>}
            <label htmlFor="business-note-content">Notes <span>PRIVATE TO YOUR ACCOUNT</span></label>
            <textarea id="business-note-content" className="business-note-content" value={businessNote} onChange={(event) => setBusinessNote(event.target.value)} placeholder="Write your research, findings, ideas, questions, or next steps…" rows={10} maxLength={50000} disabled={businessNoteSaving} />
            <label htmlFor="business-note-images">Images <span>UP TO {maxBusinessImages}, 5 MB EACH</span></label>
            <input id="business-note-images" className="business-note-file-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={selectBusinessNoteImages} disabled={businessNoteSaving || businessNoteImagePaths.length + businessNoteFiles.length >= maxBusinessImages} />
            {businessImageError && <p className="business-note-image-error" role="alert">{businessImageError}</p>}
            {(businessNoteImages.length > 0 || businessNoteFiles.length > 0) && <div className="business-note-image-grid">
              {businessNoteImages.map((image) => <div className="business-note-image" key={image.path}><a href={image.url} target="_blank" rel="noreferrer"><img src={image.url} alt={`Attachment for ${selectedIdea.title}`} /></a><button type="button" onClick={() => { setBusinessNoteImages((current) => current.filter((entry) => entry.path !== image.path)); setBusinessNoteImagePaths((current) => current.filter((path) => path !== image.path)) }} aria-label="Remove attached image" disabled={businessNoteSaving}><Icon name="close" size={14} /></button></div>)}
              {businessNoteFiles.map((image) => <div className="business-note-image" key={image.previewUrl}><img src={image.previewUrl} alt={`New attachment for ${selectedIdea.title}`} /><button type="button" onClick={() => { URL.revokeObjectURL(image.previewUrl); setBusinessNoteFiles((current) => current.filter((entry) => entry.previewUrl !== image.previewUrl)) }} aria-label="Remove selected image" disabled={businessNoteSaving}><Icon name="close" size={14} /></button></div>)}
            </div>}
            <button type="submit" className="primary-button modal-submit" disabled={businessNoteSaving}><Icon name="check" size={16} /> {businessNoteSaving ? 'Saving notes…' : 'Save notes'}</button>
          </>}
        </form>
      </div>}
      {moneyModalOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setMoneyModalOpen(false) }}>
        <form className="idea-modal money-modal" onSubmit={saveMoneyEntry}>
          <button type="button" className="modal-close" onClick={() => setMoneyModalOpen(false)} aria-label="Close"><Icon name="close" size={18} /></button>
          <div className="modal-mark money-modal-mark"><Icon name={moneyModalType === 'transaction' ? 'wallet' : moneyModalType === 'emi' ? 'clock' : 'card'} size={21} /></div>
          <span className="section-kicker">{moneyModalType === 'transaction' ? 'KEEP YOUR MONEY LOG CURRENT' : moneyModalType === 'emi' ? 'MONTHLY COMMITMENT' : 'PAYMENT METHOD'}</span>
          <h2>{moneyModalType === 'transaction' ? editingTransactionId ? 'Edit payment' : 'Add a money entry' : moneyModalType === 'emi' ? editingCommitmentId ? 'Edit EMI' : 'Add an EMI reminder' : editingCommitmentId ? 'Edit credit card' : 'Add a credit card'}</h2>
          <p>{moneyModalType === 'transaction' ? 'Your entries are saved to your private Supabase account.' : moneyModalType === 'emi' ? 'Your EMI details are saved to your private Supabase account.' : 'Card details are saved to your private Supabase account.'}</p>
          {moneyModalType === 'transaction' && <><label htmlFor="entry-type">Entry type</label><select id="entry-type" value={entryType} onChange={(event) => { setEntryType(event.target.value); setEntryCategory(''); setEntryCard('') }}><option>Income</option><option>Spending</option></select></>}
          <label htmlFor="entry-name">{moneyModalType === 'transaction' ? entryType === 'Income' ? 'Income source' : 'Payment or merchant' : moneyModalType === 'emi' ? 'EMI or loan name' : 'Card name'}</label>
          <input id="entry-name" autoFocus maxLength={100} value={entryName} onChange={(event) => setEntryName(event.target.value)} placeholder={moneyModalType === 'transaction' ? entryType === 'Income' ? 'e.g. Salary, freelance, other income' : 'e.g. Grocery shop, electricity bill' : moneyModalType === 'emi' ? 'e.g. Home or vehicle EMI' : 'e.g. Bank or card nickname'} required />
          {moneyModalType === 'transaction' && entryType === 'Spending' && <>
            <label htmlFor="entry-reason">Reason for this spending</label>
            <textarea id="entry-reason" maxLength={240} value={entryReason} onChange={(event) => setEntryReason(event.target.value)} placeholder="What was this payment for?" rows={2} required />
            <label htmlFor="entry-category">Payment source</label>
            <select id="entry-category" value={entryCategory} onChange={(event) => { setEntryCategory(event.target.value); setEntryCard('') }} required>
              <option value="">Choose how you paid</option>
              {paymentSources.map((source) => <option key={source}>{source}</option>)}
            </select>
            {(entryCategory === 'Credit card payment' || entryCategory === 'Card repayment') && cards.length > 0 && <>
              <label htmlFor="entry-card">Credit card <span>OPTIONAL</span></label>
              <select id="entry-card" value={entryCard} onChange={(event) => setEntryCard(event.target.value)}>
                <option value="">Not linked to a card</option>
                {cards.map((card) => <option key={card.id} value={card.name}>{card.name}</option>)}
              </select>
            </>}
          </>}
          <label htmlFor="entry-amount">{moneyModalType === 'card' ? editingCommitmentId ? 'Opening balance' : 'Current balance (optional)' : moneyModalType === 'emi' ? 'Monthly payment amount (₹)' : 'Amount (₹)'}</label>
          <input id="entry-amount" type="number" min={moneyModalType === 'card' ? '0' : '0.01'} step="0.01" value={entryAmount} onChange={(event) => setEntryAmount(event.target.value)} placeholder="0.00" required={moneyModalType !== 'card'} />
          {moneyModalType === 'transaction' && <><label htmlFor="entry-date">Date</label><input id="entry-date" type="date" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} required /></>}
          {moneyModalType === 'emi' && <>
            <label htmlFor="entry-due-date">Start date <span>REQUIRED</span></label>
            <input id="entry-due-date" type="date" value={entryDueDate} onChange={(event) => setEntryDueDate(event.target.value)} required />
            <p className="form-hint">The start date’s day of the month is used as the EMI due day.</p>
            <label htmlFor="emi-end-date">End date <span>REQUIRED</span></label>
            <input id="emi-end-date" type="date" min={entryDueDate || undefined} value={emiEndDate} onChange={(event) => setEmiEndDate(event.target.value)} required />
          </>}
          {moneyModalType === 'emi' && editingCommitmentId && <label className="emi-completed-toggle" htmlFor="emi-completed"><input id="emi-completed" type="checkbox" checked={emiCompleted} onChange={(event) => setEmiCompleted(event.target.checked)} /><span>Mark this EMI as completed</span></label>}
          {moneyModalType === 'card' && <><label htmlFor="entry-due">Payment due day</label><input id="entry-due" type="number" min="1" max="31" value={entryDueDay} onChange={(event) => setEntryDueDay(event.target.value)} placeholder="Day of month, e.g. 15" /></>}
          {cloudError && <p className="cloud-inline-error money-modal-error" role="alert">{cloudError}</p>}
          <button type="submit" className="primary-button modal-submit" disabled={cloudLoading}><Icon name={cloudLoading ? 'clock' : 'check'} size={16} /> {cloudLoading ? 'Saving…' : moneyModalType === 'transaction' ? editingTransactionId ? 'Save changes' : 'Save entry' : editingCommitmentId ? 'Save changes' : moneyModalType === 'emi' ? 'Save EMI reminder' : 'Save card'}</button>
        </form>
      </div>}
      {addTripOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !tripSaving) setAddTripOpen(false) }}>
        <form className="idea-modal trip-create-modal" onSubmit={createTrip}>
          <button type="button" className="modal-close" onClick={() => setAddTripOpen(false)} aria-label="Close" disabled={tripSaving}><Icon name="close" size={18} /></button>
          <div className="modal-mark"><Icon name="journal" size={21} /></div>
          <span className="section-kicker">A NEW MEMORY</span>
          <h2>Add a trip</h2>
          <p>Give your trip a name and add its date. You can add notes, photos, and videos after opening it.</p>
          <label htmlFor="trip-title">Trip name</label>
          <input id="trip-title" autoFocus maxLength={100} value={newTripTitle} onChange={(event) => setNewTripTitle(event.target.value)} placeholder="e.g. Weekend in Goa" required disabled={tripSaving} />
          <label htmlFor="new-trip-date">Trip date <span>OPTIONAL</span></label>
          <input id="new-trip-date" type="text" maxLength={100} value={newTripDate} onChange={(event) => setNewTripDate(event.target.value)} placeholder="e.g. 12–15 June 2026 or Summer 2026" disabled={tripSaving} />
          {tripsError && <p className="trip-error" role="alert">{tripsError}</p>}
          <button type="submit" className="primary-button modal-submit" disabled={tripSaving}><Icon name="plus" size={16} /> {tripSaving ? 'Adding trip…' : 'Add trip'}</button>
        </form>
      </div>}
    </div>
  )
}

function pageSubtitle(page) {
  const descriptions = {
    'Career & skills': 'Organize learning topics, subtopics, and notes in one place.',
    'Personal & life': 'Keep your personal goals and trip memories together in one calm, private space.',
    'Business exploration': 'Explore clothing, PG, event management, and water bottle business ideas.',
    Money: 'Track income, spending, EMIs, card purchases, and repayments together.',
    Journal: 'A private place to notice, reflect, and remember.',
    Habits: 'Tiny rituals that make your days feel a little more like yours.',
  }
  return descriptions[page] || 'A calm space for all the things you’re growing.'
}

export default App
