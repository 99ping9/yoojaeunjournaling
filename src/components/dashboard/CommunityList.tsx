import { getAnimalAvatar } from '@/lib/utils'
import { X } from 'lucide-react'
import { SUBMISSION_TYPES } from '@/types'

interface UserStatus {
    id: string
    username: string
    hasSubmittedToday: boolean
    avatar?: string
    bg_color?: string
    aura_index?: number
    thisWeekTypeCounts?: Record<string, number>
    thisWeekRequired?: number
    is_column_challenge?: boolean
}

interface CommunityListProps {
    users: UserStatus[]
    onUserClick: (user: UserStatus) => void
    currentUserId?: string
    isAdminMode?: boolean
    onDeleteUser?: (userId: string, username: string) => void
}

const CommunityList = ({ users, onUserClick, currentUserId, isAdminMode, onDeleteUser }: CommunityListProps) => {
    const me = users.find(u => u.id === currentUserId)
    const others = users
        .filter(u => u.id !== currentUserId)
        .sort((a, b) => (b.aura_index ?? 0) - (a.aura_index ?? 0))

    const displayUsers = me ? [me, ...others] : others

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                Community
                <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                    이번 주
                </span>
            </h3>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {displayUsers.map((user, idx) => {
                    const isMe = user.id === currentUserId
                    const required = user.thisWeekRequired ?? 5

                    return (
                        <div
                            key={idx}
                            className={`flex items-center justify-between p-3 rounded-xl transition-colors cursor-pointer ${isMe ? 'bg-blue-50 hover:bg-blue-100' : 'bg-slate-50/50 hover:bg-slate-100'}`}
                        >
                            <div className="flex items-center gap-3 flex-1" onClick={() => onUserClick(user)}>
                                <div className={`w-10 h-10 rounded-full ${user.bg_color || 'bg-white'} border border-slate-100 flex items-center justify-center text-xl shadow-sm shrink-0`}>
                                    {user.avatar || getAnimalAvatar(user.username)}
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <div className="flex items-center gap-1">
                                        <span className="text-sm font-medium text-slate-700 truncate">
                                            {user.username}
                                        </span>
                                        {isMe && (
                                            <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-semibold shrink-0">나</span>
                                        )}
                                    </div>
                                    <span className="text-xs text-amber-500 font-semibold">
                                        아우라지수 : {user.aura_index ?? 0}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="flex gap-1 flex-wrap justify-end">
                                    {SUBMISSION_TYPES.map(t => {
                                        const count = user.thisWeekTypeCounts?.[t.id] ?? 0
                                        const done = count >= required
                                        return (
                                            <div
                                                key={t.id}
                                                className={`flex flex-col items-center justify-center text-[10px] px-1.5 py-0.5 rounded border ${done ? 'bg-green-50 text-green-600 border-green-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}
                                                title={t.label}
                                            >
                                                <span className="font-semibold">{t.label}</span>
                                                <span>{count}/{required}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                                {isAdminMode && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onDeleteUser?.(user.id, user.username)
                                        }}
                                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors ml-1"
                                        title="사용자 삭제"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export default CommunityList
