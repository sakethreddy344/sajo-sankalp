import { useEffect, useMemo, useRef, useState } from 'react'
import { fromCardRow, fromEmiRow, fromMoneyEntryRow, toCardRow, toEmiRow, toMoneyEntryRow } from './moneyData'
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

function escapeCalendarText(value) {
  return String(value)
    .replaceAll('\\', '\\\\')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
    .replaceAll(/\r?\n/g, '\\n')
}

function emiCalendarFile(emi) {
  let nextDue
  if (emi.startDate) {
    nextDue = new Date(`${emi.startDate}T00:00:00`)
  } else {
    const today = new Date()
    const dueDay = Number(emi.dueDay)
    nextDue = new Date(today.getFullYear(), today.getMonth(), Math.min(dueDay, new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()))
    if (nextDue < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1)
      nextDue = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), Math.min(dueDay, new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate()))
    }
  }
  const endDate = new Date(nextDue.getFullYear(), nextDue.getMonth(), nextDue.getDate() + 1)
  const formatCalendarDate = (date) => `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
  const title = `EMI payment: ${emi.name}`
  const details = `Monthly EMI: Rs ${Number(emi.amount).toLocaleString('en-IN')}. Reminder one day before the due date.`
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Daymark//EMI Reminder//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${window.crypto.randomUUID()}@daymark.local`,
    `DTSTAMP:${new Date().toISOString().replaceAll('-', '').replaceAll(':', '').replace(/\.\d{3}/, '')}`,
    `DTSTART;VALUE=DATE:${formatCalendarDate(nextDue)}`,
    `DTEND;VALUE=DATE:${formatCalendarDate(endDate)}`,
    `RRULE:FREQ=MONTHLY;BYMONTHDAY=${nextDue.getDate()}`,
    `SUMMARY:${escapeCalendarText(title)}`,
    `DESCRIPTION:${escapeCalendarText(details)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:EMI due tomorrow',
    'TRIGGER:-P1D',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
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

const downloadEmiCalendarReminder = (emi) => {
  const calendar = emiCalendarFile(emi)
  const downloadUrl = URL.createObjectURL(new Blob([calendar], { type: 'text/calendar;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = downloadUrl
  link.download = `${emi.name.trim().replace(/[^a-z0-9-]+/gi, '-') || 'emi'}-monthly-reminder.ics`
  link.click()
  URL.revokeObjectURL(downloadUrl)
  setNotice('Calendar file downloaded. Import it into Google Calendar to receive monthly reminders.')
  window.setTimeout(() => setNotice(''), 5000)
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
  const [availableCards, setAvailableCards] = useState([])
  const [completedDays, setCompletedDays] = usePersistentState('daymark-habits', [])
  const [selectedYear, setSelectedYear] = useState(appDate.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [moneyModalOpen, setMoneyModalOpen] = useState(false)
  const [moneyModalType, setMoneyModalType] = useState('transaction')
  const [editingTransactionId, setEditingTransactionId] = useState(null)
  const [session, setSession] = useState(null)
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
    if (!session || !supabase) return undefined

    let active = true
    const userId = session.user.id
    const refreshData = () => setCloudRefreshCount((count) => count + 1)
    const channel = supabase
      .channel(`money-data:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cards', filter: `user_id=eq.${userId}` }, refreshData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'available_credit_cards', filter: `user_id=eq.${userId}` }, refreshData)
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

      const [cardResult, availableCardResult, emiResult, entryResult] = await Promise.all([
        supabase.from('cards').select('*').order('created_at'),
        supabase.from('available_credit_cards').select('id, name, created_at').order('created_at'),
        supabase.from('emis').select('*').order('created_at'),
        supabase.from('money_entries').select('*').order('entry_date', { ascending: false }),
      ])
      const failedResult = [cardResult, availableCardResult, emiResult, entryResult].find((result) => result.error)
      if (failedResult?.error) throw failedResult.error
      if (!active) return

      const loadedCards = cardResult.data.map(fromCardRow)
      const loadedEntries = entryResult.data.map((row) => fromMoneyEntryRow(row, loadedCards))
      setCards(loadedCards)
      setAvailableCards(availableCardResult.data)
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
  const cardsWithBalances = cards.map((card) => ({
    ...card,
    amount: transactions.reduce((balance, entry) => {
      if (entry.cardName !== card.name) return balance
      if (entry.category === 'Credit card payment') return balance + Number(entry.amount)
      if (entry.category === 'Card repayment') return Math.max(0, balance - Number(entry.amount))
      return balance
    }, Number(card.amount) || 0),
  }))
  const totalIncome = monthTransactions.filter((entry) => entry.type === 'Income').reduce((total, entry) => total + Number(entry.amount), 0)
  const totalOutgoings = monthTransactions.filter((entry) => entry.type !== 'Income').reduce((total, entry) => total + Number(entry.amount), 0)
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
        .update({ trip_date: tripDate.trim(), notes: tripNotes, media, updated_at: new Date().toISOString() })
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
    setMoneyModalOpen(true)
  }

  const openEditTransaction = (transaction) => {
    setCloudError('')
    setEditingTransactionId(transaction.id)
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
    if (!supabase || !session) return
    const amount = Number(entryAmount)
    const name = entryName.trim()
    const reason = entryReason.trim()
    if (!name || !Number.isFinite(amount) || amount <= 0) return
    const id = window.crypto.randomUUID()
    setCloudError('')
    setCloudLoading(true)
    try {
      if (moneyModalType === 'emi') {
        if (!entryDueDate) return
        const draft = { id, name, amount, dueDay: Number(entryDueDate.slice(-2)), startDate: entryDueDate }
        const { data, error } = await supabase.from('emis').insert(toEmiRow(draft, session.user.id)).select().single()
        if (error) throw error
        setEmis((current) => [...current, fromEmiRow(data)])
      } else if (moneyModalType === 'card') {
        const draft = { id, name, amount: amount || 0, dueDay: entryDueDay }
        const { data, error } = await supabase.from('cards').insert(toCardRow(draft, session.user.id)).select().single()
        if (error) throw error
        setCards((current) => [...current, fromCardRow(data)])
      } else {
        if (entryType !== 'Income' && (!reason || !entryCategory)) return
        const updatedEntry = { id: editingTransactionId || id, name, reason, amount, date: entryDate, type: entryType, category: entryType === 'Income' ? '' : entryCategory, cardName: entryType === 'Income' ? '' : entryCard }
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
      setNotice(moneyModalType === 'emi' ? 'EMI reminder added to Supabase.' : moneyModalType === 'card' ? 'Card saved to Supabase.' : editingTransactionId ? 'Payment updated in Supabase.' : 'Payment saved to Supabase.')
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

  const deleteCard = async (card) => {
    if (!window.confirm(`Delete "${card.name}" credit card? Its payment history will be kept.`)) return
    if (!supabase || !session) return
    setCloudError('')
    setCloudLoading(true)
    try {
      const { error: linkError } = await supabase.from('money_entries').update({ card_id: null }).eq('card_id', card.id)
      if (linkError) throw linkError
      const { error } = await supabase.from('cards').delete().eq('id', card.id)
      if (error) throw error
      setCards((current) => current.filter((entry) => entry.id !== card.id))
      setTransactions((current) => current.map((entry) => (
        entry.cardId === card.id ? { ...entry, cardId: '', cardName: '' } : entry
      )))
      setNotice('Credit card deleted from Supabase.')
      window.setTimeout(() => setNotice(''), 2600)
    } catch (error) {
      setCloudError(`Could not delete this credit card from Supabase: ${error.message}`)
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
    ...emis
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
            <button className="icon-button notification-button" aria-label="Notifications"><Icon name="bell" size={18} /><i /></button>
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
              <div className="art-stats"><strong>{completedDays.length} <small>/ 7</small></strong><span>days checked in</span><div className="mini-bars">{Array.from({ length: 5 }, (_, index) => <i key={index} />)}</div></div>
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
              <p>Check that the Data API is enabled and your three tables have the expected columns and signed-in-user RLS policies.</p>
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
              <article className="money-summary money-summary-cards"><span><Icon name="card" size={18} /></span><div><small>CARD REPAYMENTS</small><strong>{formatMoney(monthTransactions.filter((entry) => entry.category === 'Card repayment' || entry.type === 'Card repayment').reduce((total, entry) => total + Number(entry.amount), 0))}</strong><em>{cards.length} cards tracked</em></div></article>
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
                  <div className="section-heading"><div><span className="section-kicker">MONTHLY COMMITMENTS</span><h2>EMIs <span className="heading-count">{emis.length}</span></h2></div><button className="round-arrow" aria-label="Add EMI" onClick={() => openMoneyForm('emi')}><Icon name="plus" size={16} /></button></div>
                  {emis.map((emi) => {
                    const payments = monthTransactions.filter((entry) => entry.category === 'EMI payment' && entry.name === emi.name)
                    return <article className="commitment-item" key={emi.id}>
                      <div className="commitment-row"><span className="commitment-icon commitment-emi"><Icon name="clock" size={16} /></span><div><strong>{emi.name}</strong><span>{formatMoney(Number(emi.amount))} / month · Due day {emi.dueDay || '—'}</span></div><button className="small-action" onClick={() => recordCommitmentPayment('EMI payment', emi)}>Log payment</button><button className="transaction-delete commitment-delete" aria-label={`Delete monthly commitment: ${emi.name}`} title="Delete monthly commitment" disabled={cloudLoading} onClick={() => deleteEmi(emi)}><Icon name="trash" size={15} /></button></div>
                      <button className="commitment-add emi-calendar-button" onClick={() => downloadEmiCalendarReminder(emi)}>Download Google Calendar reminder (.ics)</button>
                      <div className="commitment-activity">{payments.length ? payments.map((payment) => <span key={payment.id}><Icon name="check" size={12} /> Paid {formatMoney(Number(payment.amount))} on {new Date(`${payment.date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>) : <span className="no-activity">No EMI payment logged for {monthNames[selectedMonth]}.</span>}</div>
                    </article>
                  })}
                  {emis.length === 0 && <p className="commitment-empty">Add each current EMI with its monthly amount and due day to see all your commitments here.</p>}
                  <button className="commitment-add" onClick={() => openMoneyForm('emi')}><Icon name="plus" size={14} /> Add current EMI</button>
                </section>
                <section className="panel commitment-panel">
                  <div className="section-heading"><div><span className="section-kicker">CARDS & REPAYMENTS</span><h2>Card tracking <span className="heading-count">{cards.length}</span></h2></div><button className="round-arrow" aria-label="Add credit card" onClick={() => openMoneyForm('card')}><Icon name="plus" size={16} /></button></div>
                  {cardsWithBalances.map((card) => {
                    const payments = monthTransactions.filter((entry) => (entry.category === 'Credit card payment' || entry.category === 'Card repayment') && (entry.cardName === card.name || entry.name === card.name))
                    return <article className="commitment-item" key={card.id}>
                      <div className="commitment-row"><span className="commitment-icon commitment-card"><Icon name="card" size={16} /></span><div><strong>{card.name}</strong><span>{card.dueDay ? `Due day ${card.dueDay} · ` : ''}Balance {formatMoney(card.amount)}</span></div><button className="small-action" onClick={() => { setEntryName(card.name); setEntryReason(`Payment toward ${card.name} credit card`); setEntryAmount(String(card.amount || '')); setEntryType('Spending'); setEntryCategory('Card repayment'); setEntryCard(card.name); setEntryDate(`${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${selectedYear === appDate.getFullYear() && selectedMonth === appDate.getMonth() ? String(appDate.getDate()).padStart(2, '0') : '01'}`); setMoneyModalType('transaction'); setMoneyModalOpen(true) }}>Record repayment</button><button className="transaction-delete commitment-delete" aria-label={`Delete credit card: ${card.name}`} title="Delete credit card" disabled={cloudLoading} onClick={() => deleteCard(card)}><Icon name="trash" size={15} /></button></div>
                      <div className="commitment-activity">{payments.length ? payments.map((payment) => <span key={payment.id}><Icon name="check" size={12} /> {payment.category}: {formatMoney(Number(payment.amount))} · {payment.reason}</span>) : <span className="no-activity">No card payment logged for {monthNames[selectedMonth]}.</span>}</div>
                    </article>
                  })}
                  {cards.length === 0 && <p className="commitment-empty">Add your cards so purchases and repayments are easy to organize.</p>}
                  <button className="commitment-add" onClick={() => openMoneyForm('card')}><Icon name="plus" size={14} /> Add credit card</button>
                </section>
                <section className="money-tip"><Icon name="spark" size={16} /><p><strong>A note on card payments</strong>Track a card purchase and its repayment as separate entries. Repayments are shown separately so the same spending is not counted twice.</p></section>
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
                <button type="submit" className="primary-button trip-save-button" disabled={tripSaving}><Icon name="check" size={16} /> {tripSaving ? 'Saving trip…' : 'Save memories'}</button>
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
                    <div className="goal-main"><div className="goal-title-row"><h3>{goal.title}</h3>{goal.category !== 'Career & skills' && <span>{goal.progress}/{goal.total}</span>}</div><p>{goal.category}</p></div>
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
          <h2>{moneyModalType === 'transaction' ? editingTransactionId ? 'Edit payment' : 'Add a money entry' : moneyModalType === 'emi' ? 'Add an EMI reminder' : 'Add a credit card'}</h2>
          <p>{moneyModalType === 'transaction' ? 'Your entries are saved to your private Supabase account.' : moneyModalType === 'emi' ? 'Save this EMI to Supabase, then download a recurring Google Calendar reminder.' : 'Card details are saved to your private Supabase account.'}</p>
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
          <label htmlFor="entry-amount">{moneyModalType === 'card' ? 'Current balance (optional)' : moneyModalType === 'emi' ? 'Monthly payment amount (₹)' : 'Amount (₹)'}</label>
          <input id="entry-amount" type="number" min={moneyModalType === 'card' ? '0' : '0.01'} step="0.01" value={entryAmount} onChange={(event) => setEntryAmount(event.target.value)} placeholder="0.00" required={moneyModalType !== 'card'} />
          {moneyModalType === 'transaction' && <><label htmlFor="entry-date">Date</label><input id="entry-date" type="date" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} required /></>}
          {moneyModalType === 'emi' && <><label htmlFor="entry-due-date">First EMI due date <span>REQUIRED</span></label><input id="entry-due-date" type="date" value={entryDueDate} onChange={(event) => setEntryDueDate(event.target.value)} required /><p className="form-hint">The Google Calendar event will repeat monthly and alert you one day before.</p></>}
          {moneyModalType === 'card' && <><label htmlFor="entry-due">Payment due day</label><input id="entry-due" type="number" min="1" max="31" value={entryDueDay} onChange={(event) => setEntryDueDay(event.target.value)} placeholder="Day of month, e.g. 15" /></>}
          <button type="submit" className="primary-button modal-submit"><Icon name="check" size={16} /> {moneyModalType === 'transaction' ? editingTransactionId ? 'Save changes' : 'Save entry' : moneyModalType === 'emi' ? 'Save EMI reminder' : 'Save card'}</button>
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
