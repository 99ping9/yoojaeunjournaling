import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

import { getAnimalAvatar } from '@/lib/utils'
import Calendar from '@/components/dashboard/Calendar'
import SubmissionModal from '@/components/dashboard/SubmissionModal'
import CommunityList from '@/components/dashboard/CommunityList'
import { Loader2, Plus, Pencil, Check, X } from 'lucide-react'

import { startOfWeek, endOfWeek, eachDayOfInterval, subWeeks, isWeekend, isBefore, isSameDay } from 'date-fns'
import { SubmissionType, SUBMISSION_TYPES } from '@/types'
import { ANIMALS, BG_COLORS, HOLIDAYS_2026 } from '@/lib/constants'

// Programme launches Feb 22 2026 — no fine or logging before this date
const PROGRAM_START_DATE = new Date(2026, 1, 22) // Feb 22, 2026

const Dashboard = () => {
    const { user, updateProfile, updateColumnChallenge } = useAuth()
    const [viewedUser, setViewedUser] = useState<{ id: string, username: string, avatar: string, bg_color: string, is_column_challenge: boolean, created_at?: string } | null>(null)
    const isViewingSelf = user?.id === viewedUser?.id

    const [submissions, setSubmissions] = useState<Record<string, SubmissionType[]>>({})
    const [submissionDetails, setSubmissionDetails] = useState<Record<string, Record<string, { link: string, amount: number | null }>>>({}) // date -> type -> {link, amount}
    const [submissionsLoaded, setSubmissionsLoaded] = useState(false)
    const [communityStatus, setCommunityStatus] = useState<{ id: string, username: string, hasSubmittedToday: boolean, avatar?: string, bg_color?: string, lastWeekFine?: number, is_column_challenge?: boolean }[]>([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedDate, setSelectedDate] = useState(new Date())
    const [selectedDefaultType, setSelectedDefaultType] = useState<SubmissionType | undefined>(undefined)
    const [isAdminMode, setIsAdminMode] = useState(false)



    // Name Editing State
    const [isEditingName, setIsEditingName] = useState(false)
    const [tempName, setTempName] = useState('')
    const [tempAvatar, setTempAvatar] = useState('')
    const [tempBgColor, setTempBgColor] = useState('')

    const handleUpdateName = async () => {
        if (!tempName.trim()) return

        setIsEditingName(false) // Optimistic close
        const { success, error } = await updateProfile(tempName, tempAvatar, tempBgColor)

        if (!success) {
            console.error('Update failed:', error)
            alert(typeof error === 'string' ? error : 'Failed to update profile. Check console for details.')
            setIsEditingName(true) // Re-open on error
        } else {
            await fetchData() // Refresh to show updates
        }
    }

    useEffect(() => {
        if (user) {
            // Set initial viewed user to self
            setViewedUser({
                id: user.id,
                username: user.username,
                avatar: user.avatar || '',
                bg_color: user.bg_color || '',
                is_column_challenge: user.is_column_challenge || false
            })
            fetchData()
        }
    }, [user])

    // Update submissions when viewedUser changes
    useEffect(() => {
        if (viewedUser) {
            fetchUserSubmissions(viewedUser.id)
        }
    }, [viewedUser])

    const fetchUserSubmissions = async (userId: string) => {
        if (!userId) return

        // MOCK MODE
        if (import.meta.env.VITE_USE_MOCK === 'true') {
            const mockSubMap: Record<string, SubmissionType[]> = {}
            // Generate DETERMINISTIC mock data based on userId
            const seed = userId.charCodeAt(0) || 0
            const today = new Date()
            for (let i = 1; i <= today.getDate(); i++) {
                if ((i + seed) % 3 === 0) {
                    const d = new Date(today.getFullYear(), today.getMonth(), i)
                    const dateStr = format(d, 'yyyy-MM-dd')
                    mockSubMap[dateStr] = ['journal'] // Simplification for mock
                }
            }
            setSubmissions(mockSubMap)
            return
        }

        // REAL MODE
        setSubmissionsLoaded(false)
        const { data: journals, error } = await supabase
            .from('yje_journals')
            .select('date, type, link, amount')
            .eq('user_id', userId)

        if (error) {
            console.error('Error fetching submissions:', error)
            return
        }

        const subMap: Record<string, SubmissionType[]> = {}
        const detailMap: Record<string, Record<string, { link: string, amount: number | null }>> = {}
        journals?.forEach(j => {
            const dateKey = j.date
            if (!subMap[dateKey]) subMap[dateKey] = []
            subMap[dateKey].push(j.type as SubmissionType)
            if (!detailMap[dateKey]) detailMap[dateKey] = {}
            detailMap[dateKey][j.type] = { link: j.link || '', amount: j.amount ?? null }
        })
        setSubmissions(subMap)
        setSubmissionDetails(detailMap)
        setSubmissionsLoaded(true)
    }

    const fetchData = async () => {
        try {
            setLoading(true)

            // MOCK MODE DATA
            if (import.meta.env.VITE_USE_MOCK === 'true') {
                console.log('Mock Dashboard Data Active')

                // Mock Community Status
                setCommunityStatus([
                    { id: '1', username: 'Alice', hasSubmittedToday: true, bg_color: 'bg-red-100', avatar: '🐶' },
                    { id: '2', username: 'Bob', hasSubmittedToday: false, bg_color: 'bg-blue-100', avatar: '🐱' },
                    { id: '3', username: 'Charlie', hasSubmittedToday: true, avatar: '🐯', bg_color: 'bg-yellow-100' },
                    { id: '4', username: 'David', hasSubmittedToday: false, avatar: '🦁', bg_color: 'bg-green-100' },
                    {
                        id: user?.id || 'me',
                        username: user?.username || 'You',
                        hasSubmittedToday: false, // Will be updated by logic below if we had mock submission logic consistent
                        avatar: user?.avatar,
                        bg_color: user?.bg_color
                    }
                ].sort((a, b) => {
                    if (a.hasSubmittedToday === b.hasSubmittedToday) {
                        return a.username.localeCompare(b.username)
                    }
                    return a.hasSubmittedToday ? -1 : 1
                }))

                setLoading(false)
                return
            }

            // 1. Fetch User's Submissions (This logic is moved to fetchUserSubmissions, but we keep community status fetch here)

            // 2. Fetch Community Status (Who submitted today)
            const todayStr = format(new Date(), 'yyyy-MM-dd')

            // Get all users
            const { data: allUsers, error: usersError } = await supabase
                .from('yje_users')
                .select('id, username, avatar, bg_color, is_column_challenge') // Fetch new fields

            if (usersError) throw usersError

            // Fetch submissions for the past week to calculate fines for all users
            const today = new Date()
            const lastWeekStart = startOfWeek(subWeeks(today, 1), { weekStartsOn: 0 })
            const lastWeekEnd = endOfWeek(subWeeks(today, 1), { weekStartsOn: 0 })
            const startStr = format(lastWeekStart, 'yyyy-MM-dd')
            const endStr = format(lastWeekEnd, 'yyyy-MM-dd')

            const { data: pastWeekJournals, error: pastWeekError } = await supabase
                .from('yje_journals')
                .select('user_id, date, type')
                .gte('date', startStr)
                .lte('date', endStr)

            if (pastWeekError) throw pastWeekError

            const requiredDaysCount = eachDayOfInterval({ start: lastWeekStart, end: lastWeekEnd })
                .filter(day => !isWeekend(day))
                .filter(day => !isBefore(day, PROGRAM_START_DATE))
                .filter(day => !HOLIDAYS_2026[format(day, 'yyyy-MM-dd')])
                .length;

            const allWeekDays = eachDayOfInterval({ start: lastWeekStart, end: lastWeekEnd });

            const userFines: Record<string, number> = {}
            const userLastWeekCompletions: Record<string, { count: number, required: number, typeCounts: Record<string, number>, penaltyReasons: string }> = {}

            allUsers?.forEach(u => {
                const isParticipant = u.is_column_challenge ?? false
                const requiredTypes: SubmissionType[] = ['journal', 'account', 'thread', 'mate']
                if (isParticipant) requiredTypes.push('column')

                const typeCounts: Record<string, number> = {}
                requiredTypes.forEach(t => typeCounts[t] = 0)
                let totalCompleted = 0

                allWeekDays.forEach(day => {
                    const dateKey = format(day, 'yyyy-MM-dd')
                    const userDaySubs = pastWeekJournals?.filter(j => j.user_id === u.id && j.date === dateKey).map(j => j.type) || []

                    userDaySubs.forEach(t => {
                        if (requiredTypes.includes(t as SubmissionType)) {
                            // Only count up to 1 per day per type (since userDaySubs shouldn't have duplicates, but just in case)
                            typeCounts[t]++
                        }
                    })
                })

                let totalMisses = 0
                const missedTypes: string[] = []

                requiredTypes.forEach(t => {
                    const count = typeCounts[t]
                    totalCompleted += count
                    if (count < requiredDaysCount) {
                        const misses = requiredDaysCount - count
                        totalMisses += misses
                        const label = SUBMISSION_TYPES.find(x => x.id === t)?.label || t
                        missedTypes.push(`${label} -${misses}건`)
                    }
                })

                userFines[u.id] = totalMisses * 10000
                userLastWeekCompletions[u.id] = {
                    count: totalCompleted,
                    required: requiredTypes.length * requiredDaysCount,
                    typeCounts: typeCounts,
                    penaltyReasons: missedTypes.length > 0 ? missedTypes.join(', ') : ''
                }
            })

            // Get all submissions for today
            const { data: todayJournals, error: todayError } = await supabase
                .from('yje_journals')
                .select('user_id')
                .eq('date', todayStr)

            if (todayError) throw todayError

            const submittedUserIds = new Set(todayJournals?.map(j => j.user_id))

            const commStatus = allUsers?.map(u => ({
                id: u.id,
                username: u.username,
                hasSubmittedToday: submittedUserIds.has(u.id),
                avatar: u.avatar,
                bg_color: u.bg_color,
                lastWeekFine: userFines[u.id] || 0,
                lastWeekCompletionCount: userLastWeekCompletions[u.id]?.count || 0,
                lastWeekRequired: userLastWeekCompletions[u.id]?.required || 20,
                lastWeekTypeCounts: userLastWeekCompletions[u.id]?.typeCounts || {},
                penaltyReasons: userLastWeekCompletions[u.id]?.penaltyReasons || '',
                is_column_challenge: u.is_column_challenge ?? false
            })).sort((a, b) => {
                // Current user always first
                if (a.id === user?.id) return -1
                if (b.id === user?.id) return 1
                // Rest: alphabetical (Korean)
                return a.username.localeCompare(b.username, 'ko')
            }) || []

            setCommunityStatus(commStatus)

        } catch (error) {
            console.error('Error fetching dashboard data:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleDateClick = (date: Date, defaultType?: SubmissionType) => {
        const is22nd = isSameDay(date, new Date(2026, 1, 22))

        // Block before program start for normal users, allow for admins for testing
        if (!isAdminMode && !is22nd && isBefore(date, PROGRAM_START_DATE) && !isSameDay(date, PROGRAM_START_DATE)) return

        if (!isAdminMode) {
            const today = new Date()

            const dDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
            const dToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())

            const isTodayValue = dToday.getTime() === dDate.getTime()
            const isYesterday = dToday.getTime() - dDate.getTime() === 24 * 60 * 60 * 1000

            // Only allow today, yesterday, and the 22nd
            if (!isTodayValue && !isYesterday && !is22nd) return
        }

        setSelectedDate(date)
        setSelectedDefaultType(defaultType)
        setIsModalOpen(true)
    }

    const handleSubmit = async (data: { link: string, type: SubmissionType, amount?: number }) => {
        if (!user) return

        const targetUserId = (isAdminMode && viewedUser) ? viewedUser.id : user.id;
        const dateStr = format(selectedDate, 'yyyy-MM-dd')

        try {
            // "unchecked" or empty amount means the user wants to UNDO/delete their submission
            if (data.link === 'unchecked' || (data.type === 'account' && !data.amount && data.amount !== 0)) {
                const { error } = await supabase
                    .from('yje_journals')
                    .delete()
                    .eq('user_id', targetUserId)
                    .eq('date', dateStr)
                    .eq('type', data.type)
                if (error) {
                    console.error('Delete error:', error)
                    alert(`삭제 실패: ${error.message}`)
                    return
                }
                await fetchData()
                await fetchUserSubmissions(targetUserId)
                return
            }

            const payload = {
                user_id: targetUserId,
                date: dateStr,
                type: data.type,
                link: data.link?.trim() || 'completed',
                amount: data.amount ?? null
            }

            // Use upsert so editing existing submissions works (no duplicate error)
            const { error } = await supabase
                .from('yje_journals')
                .upsert([payload], { onConflict: 'user_id,date,type' })

            if (error) {
                console.error('Submission error:', JSON.stringify(error))
                alert(`제출 실패: ${error.message}`)
                return
            }

            await fetchData()
            await fetchUserSubmissions(targetUserId)

        } catch (err) {
            console.error('Unexpected error:', err)
            alert('예상치 못한 오류가 발생했습니다.')
        }
    }

    const handleDeleteUser = async (userIdToDelete: string, username: string) => {
        if (!isAdminMode) return

        if (!window.confirm(`정말로 '${username}' 사용자를 삭제하시겠습니까?\n이 사용자의 모든 기록이 함께 삭제되며, 복구할 수 없습니다.`)) {
            return
        }

        try {
            const { error } = await supabase
                .from('yje_users')
                .delete()
                .eq('id', userIdToDelete)

            if (error) {
                console.error('Error deleting user:', error)
                alert(`사용자 삭제 실패: ${error.message}`)
                return
            }

            // Remove from local state
            setCommunityStatus(prev => prev.filter(u => u.id !== userIdToDelete))
            if (viewedUser?.id === userIdToDelete) {
                setViewedUser(user ? {
                    id: user.id,
                    username: user.username,
                    avatar: user.avatar || '',
                    bg_color: user.bg_color || '',
                    is_column_challenge: user.is_column_challenge || false
                } : null)
            }
            alert(`'${username}' 사용자가 삭제되었습니다.`)
        } catch (err) {
            console.error('Unexpected error during deletion:', err)
            alert('삭제 중 예상치 못한 오류가 발생했습니다.')
        }
    }

    const handleChallengeToggle = async () => {
        if (!user) return
        const newVal = !viewedUser?.is_column_challenge

        // Optimistic update
        if (viewedUser) setViewedUser({ ...viewedUser, is_column_challenge: newVal })

        // Update DB and context
        await updateColumnChallenge(newVal)

        // Refresh to ensure sync
        fetchData()
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        )
    }

    // Fine Calculation: 10,000원 per missing required submission
    // Based on the full Sun-Sat week, required count dynamically calculated
    // Only counts days on or after PROGRAM_START_DATE, excluding weekends and holidays
    const calculateFine = () => {
        if (!submissionsLoaded) return 0
        const today = new Date()
        const lastWeekStart = startOfWeek(subWeeks(today, 1), { weekStartsOn: 0 })
        const lastWeekEnd = endOfWeek(subWeeks(today, 1), { weekStartsOn: 0 })

        const requiredDaysCount = eachDayOfInterval({ start: lastWeekStart, end: lastWeekEnd })
            .filter(day => !isWeekend(day))
            .filter(day => !isBefore(day, PROGRAM_START_DATE)) // skip days before program start
            .filter(day => !HOLIDAYS_2026[format(day, 'yyyy-MM-dd')])
            .length;

        const allWeekDays = eachDayOfInterval({ start: lastWeekStart, end: lastWeekEnd });

        const isParticipant = viewedUser?.is_column_challenge ?? false
        const requiredTypes: SubmissionType[] = ['journal', 'account', 'thread', 'mate']
        if (isParticipant) requiredTypes.push('column')

        const typeCounts: Record<string, number> = {}
        requiredTypes.forEach(t => typeCounts[t] = 0)

        allWeekDays.forEach(day => {
            const dateKey = format(day, 'yyyy-MM-dd')
            const daySubs = submissions[dateKey] || []

            daySubs.forEach(t => {
                if (requiredTypes.includes(t)) {
                    typeCounts[t]++
                }
            })
        })

        let totalMisses = 0
        requiredTypes.forEach(t => {
            const count = typeCounts[t]
            if (count < requiredDaysCount) {
                totalMisses += (requiredDaysCount - count)
            }
        })

        return totalMisses * 10000
    }


    const fineAmount = calculateFine()
    const isParticipant = viewedUser?.is_column_challenge ?? false

    const calculateThisWeekCounts = () => {
        if (!submissionsLoaded) return null
        const today = new Date()
        const thisWeekStart = startOfWeek(today, { weekStartsOn: 0 })
        const thisWeekEnd = endOfWeek(today, { weekStartsOn: 0 })

        const weekDays = eachDayOfInterval({ start: thisWeekStart, end: thisWeekEnd })

        const counts: Record<string, number> = {}
        SUBMISSION_TYPES.forEach(t => counts[t.id] = 0)

        weekDays.forEach(day => {
            const dateKey = format(day, 'yyyy-MM-dd')
            const daySubs = submissions[dateKey] || []
            daySubs.forEach(type => {
                if (counts[type] !== undefined) {
                    counts[type]++
                }
            })
        })
        return counts
    }

    const thisWeekCounts = calculateThisWeekCounts()

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header / Fine Section */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="space-y-2 shrink-0">
                    {!isEditingName ? (
                        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <div className={`w-10 h-10 rounded-full ${viewedUser?.bg_color || 'bg-white'} border border-slate-100 flex items-center justify-center text-xl shadow-sm mr-2 hidden md:flex`}>
                                {viewedUser?.avatar || getAnimalAvatar(viewedUser?.username || '')}
                            </div>
                            {isViewingSelf ? (
                                <>
                                    안녕하세요, <span className="text-blue-600">{user?.username}</span>님!
                                    <button
                                        onClick={() => {
                                            setTempName(user?.username || '')
                                            setTempAvatar(user?.avatar || getAnimalAvatar(user?.username || ''))
                                            setTempBgColor(user?.bg_color || 'bg-slate-100')
                                            setIsEditingName(true)
                                        }}
                                        className="text-slate-400 hover:text-blue-500 transition-colors p-1"
                                        title="Edit Profile"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                </>
                            ) : (
                                <>
                                    <span className="text-blue-600">{viewedUser?.username}</span>님의 저널링 기록
                                    <button
                                        onClick={() => user && setViewedUser({
                                            id: user.id,
                                            username: user.username,
                                            avatar: user.avatar || '',
                                            bg_color: user.bg_color || '',
                                            is_column_challenge: user.is_column_challenge || false
                                        })}
                                        className="ml-2 text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded hover:bg-slate-200 transition-colors"
                                    >
                                        내 기록으로 돌아가기
                                    </button>
                                </>
                            )}
                        </h1>
                    ) : (
                        // ... Edit Mode UI (unchanged logic mostly, simplified for brevity in diff)
                        <div className="bg-white border border-slate-200 rounded-2xl p-5 absolute z-20 shadow-xl mt-[-20px] ml-[-20px] animate-in fade-in zoom-in-95 duration-200 w-[320px]">
                            {/* Re-using existing edit UI code logic here would be verbose, assume user keeps it or I reimplement if Blocked. 
                               Actually, I need to include the "Column Challenge" toggle here or nearby.
                               Let's put the Toggle in the main view for now as requested "Button 4".
                            */}
                            <h3 className="text-sm font-bold text-slate-400 uppercase mb-3">Edit Profile</h3>
                            {/* ... (Existing Edit UI inputs) ... */}
                            <div className="flex items-center gap-2 mb-4">
                                <input
                                    type="text"
                                    value={tempName}
                                    onChange={(e) => setTempName(e.target.value)}
                                    className="text-lg font-bold border-b-2 border-blue-500 focus:outline-none px-1 py-0.5 text-slate-800 w-full"
                                    autoFocus
                                />
                            </div>
                            {/* Avatar/Color inputs */}
                            <div className="space-y-4 mb-5">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 mb-2 block">동물 선택</label>
                                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                        {ANIMALS.slice(0, 30).map(animal => (
                                            <button
                                                key={animal}
                                                type="button"
                                                onClick={() => setTempAvatar(animal)}
                                                className={`w-10 h-10 shrink-0 text-2xl flex items-center justify-center rounded-full transition-all ${tempAvatar === animal
                                                    ? 'bg-blue-100 ring-2 ring-blue-500 shadow-sm scale-110'
                                                    : 'bg-slate-50 hover:bg-slate-100 hover:scale-105'
                                                    }`}
                                            >
                                                {animal}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 mb-2 block">배경색 선택</label>
                                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                        {BG_COLORS.map(color => (
                                            <button
                                                key={color}
                                                type="button"
                                                onClick={() => setTempBgColor(color)}
                                                className={`w-8 h-8 shrink-0 rounded-full transition-all border-2 ${color} ${tempBgColor === color
                                                    ? 'border-blue-500 shadow-md scale-110'
                                                    : 'border-transparent shadow-sm hover:scale-105'
                                                    }`}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setIsEditingName(false)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 font-medium text-sm">Cancel</button>
                                <button onClick={handleUpdateName} className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium text-sm flex items-center gap-1"><Check className="w-4 h-4" /> Save</button>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-4 text-slate-600 font-medium">
                        <span>지난주 벌금 : </span>
                        {!submissionsLoaded ? (
                            <span className="text-slate-400 font-bold animate-pulse">계산 중...</span>
                        ) : fineAmount > 0 ? (
                            <span className="text-red-500 font-bold">{fineAmount.toLocaleString()}원</span>
                        ) : (
                            <span className="text-slate-900 font-bold">0원</span>
                        )}
                    </div>
                </div>

                {/* This Week's Submission Counts */}
                <div className="flex-1 flex justify-start xl:justify-center w-full overflow-x-auto pb-2 xl:pb-0 scrollbar-hide py-2">
                    {thisWeekCounts && (
                        <div className="flex gap-2 sm:gap-3 items-center">
                            <span className="text-xs font-bold text-slate-400 mr-2 hidden sm:block">이번 주 완료</span>
                            {SUBMISSION_TYPES.map(type => {
                                if (type.id === 'column' && !isParticipant) return null;
                                const count = thisWeekCounts[type.id];
                                return (
                                    <div key={type.id} className="flex flex-col items-center bg-slate-50 border border-slate-100 px-4 py-1.5 rounded-xl min-w-[64px]">
                                        <span className="text-[11px] font-medium text-slate-500 mb-0.5">{type.label}</span>
                                        <div className="flex items-baseline gap-0.5">
                                            <span className={`text-lg font-bold ${count > 0 ? 'text-blue-600' : 'text-slate-700'}`}>{count}</span>
                                            <span className="text-[10px] text-slate-400">회</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                <div className="flex gap-2 shrink-0">
                    {/* Settings / Challenge Toggle */}
                    {isViewingSelf && (
                        <button
                            onClick={handleChallengeToggle}
                            className={`px-4 py-2 rounded-xl border text-sm font-semibold transition-all ${viewedUser?.is_column_challenge
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                : 'bg-slate-50 border-slate-200 text-slate-500'
                                }`}
                        >
                            {viewedUser?.is_column_challenge ? '🔥 칼럼 챌린지 ON' : '💤 칼럼 챌린지 OFF'}
                        </button>
                    )}

                    {isViewingSelf && (
                        <button
                            onClick={() => handleDateClick(new Date())}
                            className="bg-slate-900 text-white px-5 py-3 rounded-xl font-semibold hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 flex items-center gap-2"
                        >
                            <Plus className="w-5 h-5" />
                            Log Today
                        </button>
                    )}
                </div>
            </div>

            {/* Daily Status Table (Position 2) */}
            {/* Define today for scope */}
            {(() => {
                const today = new Date()
                return (
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 overflow-x-auto">
                        <h3 className="text-lg font-bold text-slate-800 mb-4">오늘의 현황 ({format(today, 'MM.dd')})</h3>
                        <div className="min-w-[600px] grid grid-cols-5 gap-4 text-center">
                            {SUBMISSION_TYPES.map(type => (
                                <div key={type.id} className="space-y-2">
                                    <div className="font-semibold text-slate-500 text-sm">{type.label}</div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if ((isViewingSelf || isAdminMode) && !(type.id === 'column' && !isParticipant)) {
                                                handleDateClick(today, type.id as SubmissionType);
                                            }
                                        }}
                                        disabled={!(isViewingSelf || isAdminMode) || (type.id === 'column' && !isParticipant)}
                                        className={`h-12 w-full flex items-center justify-center rounded-xl bg-slate-50 border border-slate-100 transition-colors ${(isViewingSelf || isAdminMode) && !(type.id === 'column' && !isParticipant)
                                            ? 'hover:bg-slate-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20'
                                            : 'cursor-default'
                                            }`}
                                    >
                                        {type.id === 'column' && !isParticipant ? (
                                            <span className="text-slate-300">-</span>
                                        ) : (
                                            (submissions[format(today, 'yyyy-MM-dd')] || []).includes(type.id) ? (
                                                <div className={`w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center shadow-sm ${isViewingSelf ? 'hover:bg-green-200 hover:scale-110 transition-transform' : ''}`}>
                                                    <Check className="w-5 h-5" />
                                                </div>
                                            ) : (
                                                <div className={`w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center ${isViewingSelf ? 'hover:bg-red-100 hover:scale-110 transition-transform' : ''}`}>
                                                    <X className="w-5 h-5" />
                                                </div>
                                            )
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            })()}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content: Calendar */}
                <div className="lg:col-span-2 space-y-6">
                    <Calendar
                        submissions={submissions}
                        onDateClick={isViewingSelf || isAdminMode ? handleDateClick : undefined}
                        currentDate={selectedDate}
                        isColumnParticipant={isParticipant}
                        isAdminMode={isAdminMode}
                    />
                </div>

                {/* Sidebar: Community */}
                <div className="space-y-6">
                    <CommunityList
                        users={communityStatus}
                        currentUserId={user?.id}
                        onUserClick={(u) => setViewedUser({
                            id: u.id,
                            username: u.username,
                            avatar: u.avatar || '',
                            bg_color: u.bg_color || '',
                            is_column_challenge: u.is_column_challenge || false,
                            created_at: new Date().toISOString() // Mock/Default
                        })}
                        isAdminMode={isAdminMode}
                        onDeleteUser={handleDeleteUser}
                    />

                </div>
            </div>

            <SubmissionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                date={selectedDate}
                onSubmit={handleSubmit}
                submittedTypes={submissions[format(selectedDate, 'yyyy-MM-dd')] || []}
                existingData={submissionDetails[format(selectedDate, 'yyyy-MM-dd')] || {}}
                isColumnParticipant={isParticipant}
                defaultType={selectedDefaultType}
                isAdminViewing={false}
            />

            {/* Admin Mode - subtle button at very bottom */}
            <div className="flex justify-center pt-4 pb-2">
                {isAdminMode ? (
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-amber-600 font-semibold bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">🔑 관리자 모드 활성</span>
                        <button
                            onClick={() => setIsAdminMode(false)}
                            className="text-xs text-slate-400 hover:text-red-500 transition-colors underline"
                        >
                            관리자 모드 OFF
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => {
                            const pw = window.prompt('관리자 비밀번호를 입력하세요:')
                            if (pw === '1212') {
                                setIsAdminMode(true)
                            } else if (pw !== null) {
                                alert('비밀번호가 올바르지 않습니다.')
                            }
                        }}
                        className="text-[10px] text-slate-200 hover:text-slate-400 transition-colors select-none"
                    >
                        관리자
                    </button>
                )}
            </div>
        </div>
    )
}

export default Dashboard
