import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

import { getAnimalAvatar } from '@/lib/utils'
import Calendar from '@/components/dashboard/Calendar'
import SubmissionModal from '@/components/dashboard/SubmissionModal'
import CommunityList from '@/components/dashboard/CommunityList'
import { Loader2, Plus, Pencil, Check, X } from 'lucide-react'

import { startOfWeek, endOfWeek, eachDayOfInterval, isWeekend, isBefore, isSameDay } from 'date-fns'
import { SubmissionType, SUBMISSION_TYPES } from '@/types'
import { ANIMALS, BG_COLORS, HOLIDAYS_2026 } from '@/lib/constants'

const PROGRAM_START_DATE = new Date(2026, 1, 22)

const Dashboard = () => {
    const { user, updateProfile } = useAuth()
    const [viewedUser, setViewedUser] = useState<{ id: string, username: string, avatar: string, bg_color: string, is_column_challenge: boolean, aura_index?: number } | null>(null)
    const isViewingSelf = user?.id === viewedUser?.id

    const [submissions, setSubmissions] = useState<Record<string, SubmissionType[]>>({})
    const [submissionDetails, setSubmissionDetails] = useState<Record<string, Record<string, { link: string, amount: number | null }>>>({})
    const [communityStatus, setCommunityStatus] = useState<{
        id: string, username: string, hasSubmittedToday: boolean,
        avatar?: string, bg_color?: string, aura_index?: number,
        thisWeekTypeCounts?: Record<string, number>, thisWeekRequired?: number,
        is_column_challenge?: boolean
    }[]>([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedDate, setSelectedDate] = useState(new Date())
    const [selectedDefaultType, setSelectedDefaultType] = useState<SubmissionType | undefined>(undefined)
    const [isAdminMode, setIsAdminMode] = useState(false)

    const [isEditingName, setIsEditingName] = useState(false)
    const [tempName, setTempName] = useState('')
    const [tempAvatar, setTempAvatar] = useState('')
    const [tempBgColor, setTempBgColor] = useState('')

    const handleUpdateName = async () => {
        if (!tempName.trim()) return
        setIsEditingName(false)
        const { success, error } = await updateProfile(tempName, tempAvatar, tempBgColor)
        if (!success) {
            console.error('Update failed:', error)
            alert(typeof error === 'string' ? error : 'Failed to update profile.')
            setIsEditingName(true)
        } else {
            await fetchData()
        }
    }

    useEffect(() => {
        if (user) {
            setViewedUser({
                id: user.id,
                username: user.username,
                avatar: user.avatar || '',
                bg_color: user.bg_color || '',
                is_column_challenge: user.is_column_challenge || false,
                aura_index: user.aura_index ?? 0
            })
            fetchData()
        }
    }, [user])

    useEffect(() => {
        if (viewedUser) {
            fetchUserSubmissions(viewedUser.id)
        }
    }, [viewedUser])

    const fetchUserSubmissions = async (userId: string) => {
        if (!userId) return
        const { data: journals, error } = await supabase
            .from('yje_journals')
            .select('date, type, link, amount')
            .eq('user_id', userId)

        if (error) { console.error('Error fetching submissions:', error); return }

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
    }

    const fetchData = async () => {
        try {
            setLoading(true)
            const todayStr = format(new Date(), 'yyyy-MM-dd')

            const { data: allUsers, error: usersError } = await supabase
                .from('yje_users')
                .select('id, username, avatar, bg_color, is_column_challenge, aura_index')
            if (usersError) throw usersError

            const today = new Date()
            const thisWeekStart = startOfWeek(today, { weekStartsOn: 0 })
            const thisWeekEnd = endOfWeek(today, { weekStartsOn: 0 })
            const startStr = format(thisWeekStart, 'yyyy-MM-dd')
            const endStr = format(thisWeekEnd, 'yyyy-MM-dd')

            const { data: thisWeekJournals } = await supabase
                .from('yje_journals')
                .select('user_id, date, type')
                .gte('date', startStr)
                .lte('date', endStr)

            const requiredDaysCount = eachDayOfInterval({ start: thisWeekStart, end: thisWeekEnd })
                .filter(day => !isWeekend(day))
                .filter(day => !isBefore(day, PROGRAM_START_DATE))
                .filter(day => !HOLIDAYS_2026[format(day, 'yyyy-MM-dd')])
                .length

            const allWeekDays = eachDayOfInterval({ start: thisWeekStart, end: thisWeekEnd })

            const { data: todayJournals } = await supabase
                .from('yje_journals')
                .select('user_id')
                .eq('date', todayStr)

            const submittedUserIds = new Set(todayJournals?.map(j => j.user_id))

            const commStatus = allUsers?.map(u => {
                const typeCounts: Record<string, number> = {}
                SUBMISSION_TYPES.forEach(t => typeCounts[t.id] = 0)
                allWeekDays.forEach(day => {
                    const dateKey = format(day, 'yyyy-MM-dd')

                    thisWeekJournals?.filter(j => j.user_id === u.id && j.date === dateKey)
                        .forEach(j => { if (typeCounts[j.type] !== undefined) typeCounts[j.type]++ })
                })
                return {
                    id: u.id,
                    username: u.username,
                    hasSubmittedToday: submittedUserIds.has(u.id),
                    avatar: u.avatar,
                    bg_color: u.bg_color,
                    aura_index: u.aura_index ?? 0,
                    thisWeekTypeCounts: typeCounts,
                    thisWeekRequired: requiredDaysCount,
                    is_column_challenge: u.is_column_challenge ?? false
                }
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
        if (!isAdminMode && !is22nd && isBefore(date, PROGRAM_START_DATE) && !isSameDay(date, PROGRAM_START_DATE)) return
        if (!isAdminMode) {
            // 주말/공휴일 작성 제한 제거 (사용자 요청: 주말에도 작성 가능)
            /*
            const dateStr = format(date, 'yyyy-MM-dd')
            if (isWeekend(date) || HOLIDAYS_2026[dateStr]) {
                alert('주말 및 공휴일은 휴식일입니다! 🎉')
                return
            }
            */

            const today = new Date()
            const dDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
            const dToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
            const isTodayValue = dToday.getTime() === dDate.getTime()
            const isYesterday = dToday.getTime() - dDate.getTime() === 24 * 60 * 60 * 1000
            if (!isTodayValue && !isYesterday && !is22nd) return
        }
        setSelectedDate(date)
        setSelectedDefaultType(defaultType)
        setIsModalOpen(true)
    }

    const handleSubmit = async (data: { link: string, type: SubmissionType, amount?: number }) => {
        if (!user) return
        const targetUserId = (isAdminMode && viewedUser) ? viewedUser.id : user.id
        const dateStr = format(selectedDate, 'yyyy-MM-dd')

        try {
            // 삭제 처리 (unchecked인 경우)
            if (data.link === 'unchecked') {
                const wasSubmitted = (submissions[dateStr] || []).includes(data.type)

                const { error } = await supabase
                    .from('yje_journals')
                    .delete()
                    .eq('user_id', targetUserId)
                    .eq('date', dateStr)
                    .eq('type', data.type)

                if (error) { alert(`삭제 실패: ${error.message}`); return }

                // 아우라지수 -1 (기존에 제출된 상태였을 때만)
                if (wasSubmitted) {
                    const currentAura = viewedUser?.aura_index ?? 0
                    const newAura = Math.max(0, currentAura - 1)
                    await supabase.from('yje_users')
                        .update({ aura_index: newAura })
                        .eq('id', targetUserId)

                    if (isViewingSelf) {
                        updateProfile(user.username, user.avatar || '', user.bg_color || '', user.is_column_challenge, newAura)
                    }
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

            // 이미 제출했는지 확인
            const isNew = !(submissions[dateStr] || []).includes(data.type)

            const { error } = await supabase
                .from('yje_journals')
                .upsert([payload], { onConflict: 'user_id,date,type' })

            if (error) { alert(`제출 실패: ${error.message}`); return }

            // 아우라지수 +1 (신규 제출일 때만 즉시 반영)
            if (isNew) {
                const currentAura = viewedUser?.aura_index ?? 0
                const newAura = currentAura + 1
                await supabase.from('yje_users')
                    .update({ aura_index: newAura })
                    .eq('id', targetUserId)

                // 메모리 내 정보도 업데이트하여 즉시 반영되게 함
                if (isViewingSelf) {
                    updateProfile(user.username, user.avatar || '', user.bg_color || '', user.is_column_challenge, newAura)
                }
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
        if (!window.confirm(`정말로 '${username}' 사용자를 삭제하시겠습니까?`)) return
        try {
            const { error } = await supabase.from('yje_users').delete().eq('id', userIdToDelete)
            if (error) { alert(`사용자 삭제 실패: ${error.message}`); return }
            setCommunityStatus(prev => prev.filter(u => u.id !== userIdToDelete))
            if (viewedUser?.id === userIdToDelete && user) {
                setViewedUser({ id: user.id, username: user.username, avatar: user.avatar || '', bg_color: user.bg_color || '', is_column_challenge: false, aura_index: user.aura_index ?? 0 })
            }
            alert(`'${username}' 사용자가 삭제되었습니다.`)
        } catch (err) {
            console.error('Unexpected error during deletion:', err)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        )
    }

    const calculateThisWeekCounts = () => {
        const today = new Date()
        const thisWeekStart = startOfWeek(today, { weekStartsOn: 0 })
        const thisWeekEnd = endOfWeek(today, { weekStartsOn: 0 })
        const weekDays = eachDayOfInterval({ start: thisWeekStart, end: thisWeekEnd })
        const counts: Record<string, number> = {}
        SUBMISSION_TYPES.forEach(t => counts[t.id] = 0)
        weekDays.forEach(day => {
            const dateKey = format(day, 'yyyy-MM-dd')

            const daySubs = submissions[dateKey] || []
            daySubs.forEach(type => { if (counts[type] !== undefined) counts[type]++ })
        })
        return counts
    }

    const thisWeekCounts = calculateThisWeekCounts()

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header / Profile Section */}
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
                                    <button onClick={() => { setTempName(user?.username || ''); setTempAvatar(user?.avatar || getAnimalAvatar(user?.username || '')); setTempBgColor(user?.bg_color || 'bg-slate-100'); setIsEditingName(true) }} className="text-slate-400 hover:text-blue-500 transition-colors p-1">
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                </>
                            ) : (
                                <>
                                    <span className="text-blue-600">{viewedUser?.username}</span>님의 기록
                                    <button onClick={() => user && setViewedUser({ id: user.id, username: user.username, avatar: user.avatar || '', bg_color: user.bg_color || '', is_column_challenge: false, aura_index: user.aura_index ?? 0 })} className="ml-2 text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded hover:bg-slate-200 transition-colors">
                                        내 기록으로 돌아가기
                                    </button>
                                </>
                            )}
                        </h1>
                    ) : (
                        <div className="bg-white border border-slate-200 rounded-2xl p-5 absolute z-20 shadow-xl mt-[-20px] ml-[-20px] animate-in fade-in zoom-in-95 duration-200 w-[320px]">
                            <h3 className="text-sm font-bold text-slate-400 uppercase mb-3">프로필 수정</h3>
                            <div className="flex items-center gap-2 mb-4">
                                <input type="text" value={tempName} onChange={(e) => setTempName(e.target.value)} className="text-lg font-bold border-b-2 border-blue-500 focus:outline-none px-1 py-0.5 text-slate-800 w-full" autoFocus />
                            </div>
                            <div className="space-y-4 mb-5">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 mb-2 block">동물 선택</label>
                                    <div className="flex gap-2 overflow-x-auto pb-2">
                                        {ANIMALS.slice(0, 30).map(animal => (
                                            <button key={animal} type="button" onClick={() => setTempAvatar(animal)} className={`w-10 h-10 shrink-0 text-2xl flex items-center justify-center rounded-full transition-all ${tempAvatar === animal ? 'bg-blue-100 ring-2 ring-blue-500 scale-110' : 'bg-slate-50 hover:bg-slate-100'}`}>{animal}</button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 mb-2 block">배경색 선택</label>
                                    <div className="flex gap-2 overflow-x-auto pb-2">
                                        {BG_COLORS.map(color => (
                                            <button key={color} type="button" onClick={() => setTempBgColor(color)} className={`w-8 h-8 shrink-0 rounded-full transition-all border-2 ${color} ${tempBgColor === color ? 'border-blue-500 shadow-md scale-110' : 'border-transparent shadow-sm'}`} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setIsEditingName(false)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 font-medium text-sm">취소</button>
                                <button onClick={handleUpdateName} className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium text-sm flex items-center gap-1"><Check className="w-4 h-4" /> 저장</button>
                            </div>
                        </div>
                    )}
                </div>

                {/* This Week Counts */}
                <div className="flex-1 flex justify-start xl:justify-center w-full overflow-x-auto pb-2 xl:pb-0 py-2">
                    {thisWeekCounts && (
                        <div className="flex gap-2 sm:gap-3 items-center">
                            <span className="text-xs font-bold text-slate-400 mr-2 hidden sm:block">이번 주 완료</span>
                            {SUBMISSION_TYPES.map(type => {
                                const count = thisWeekCounts[type.id]
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
                    {isViewingSelf && (
                        <button onClick={() => handleDateClick(new Date())} className="bg-slate-900 text-white px-5 py-3 rounded-xl font-semibold hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 flex items-center gap-2">
                            <Plus className="w-5 h-5" /> Log Today
                        </button>
                    )}
                </div>
            </div>

            {/* 오늘의 현황 */}
            {(() => {
                const today = new Date()
                return (
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 overflow-x-auto">
                        <h3 className="text-lg font-bold text-slate-800 mb-4">오늘의 현황 ({format(today, 'MM.dd')})</h3>
                        <div className="min-w-[400px] grid grid-cols-3 gap-4 text-center">
                            {SUBMISSION_TYPES.map(type => (
                                <div key={type.id} className="space-y-2">
                                    <div className="font-semibold text-slate-500 text-sm">{type.label}</div>
                                    <button
                                        type="button"
                                        onClick={() => { if (isViewingSelf || isAdminMode) handleDateClick(today, type.id as SubmissionType) }}
                                        disabled={!(isViewingSelf || isAdminMode)}
                                        className={`h-12 w-full flex items-center justify-center rounded-xl bg-slate-50 border border-slate-100 transition-colors ${(isViewingSelf || isAdminMode) ? 'hover:bg-slate-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20' : 'cursor-default'}`}
                                    >
                                        {(submissions[format(today, 'yyyy-MM-dd')] || []).includes(type.id) ? (
                                            <div className={`w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center shadow-sm ${isViewingSelf ? 'hover:bg-green-200 hover:scale-110 transition-transform' : ''}`}>
                                                <Check className="w-5 h-5" />
                                            </div>
                                        ) : (
                                            <div className={`w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center ${isViewingSelf ? 'hover:bg-red-100 hover:scale-110 transition-transform' : ''}`}>
                                                <X className="w-5 h-5" />
                                            </div>
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            })()}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Calendar */}
                <div className="lg:col-span-2 space-y-6">
                    <Calendar
                        submissions={submissions}
                        onDateClick={isViewingSelf || isAdminMode ? handleDateClick : undefined}
                        currentDate={selectedDate}
                        isAdminMode={isAdminMode}
                    />
                </div>

                {/* Community */}
                <div className="space-y-6">
                    <CommunityList
                        users={communityStatus}
                        currentUserId={user?.id}
                        onUserClick={(u) => setViewedUser({ id: u.id, username: u.username, avatar: u.avatar || '', bg_color: u.bg_color || '', is_column_challenge: false, aura_index: u.aura_index ?? 0 })}
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
                defaultType={selectedDefaultType}
                isAdminViewing={false}
            />

            {/* 관리자 모드 */}
            <div className="flex justify-center pt-4 pb-2">
                {isAdminMode ? (
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-amber-600 font-semibold bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">🔑 관리자 모드 활성</span>
                        <button onClick={() => setIsAdminMode(false)} className="text-xs text-slate-400 hover:text-red-500 transition-colors underline">관리자 모드 OFF</button>
                    </div>
                ) : (
                    <button
                        onClick={() => {
                            const pw = window.prompt('관리자 비밀번호를 입력하세요:')
                            if (pw === '123456') { setIsAdminMode(true) }
                            else if (pw !== null) { alert('비밀번호가 올바르지 않습니다.') }
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
