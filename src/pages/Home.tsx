import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, ArrowRight, Loader2, Plus } from 'lucide-react'

const Home = () => {
    const [name, setName] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [view, setView] = useState<'list' | 'create'>('list')
    const [users, setUsers] = useState<Array<{ username: string }>>([])
    const [loadingUsers, setLoadingUsers] = useState(true)
    const navigate = useNavigate()
    const { login } = useAuth()

    useEffect(() => {
        fetchUsers()
    }, [])

    const fetchUsers = async () => {
        try {
            setLoadingUsers(true)

            // MOCK MODE
            if (import.meta.env.VITE_USE_MOCK === 'true') {
                // Simulate network delay
                await new Promise(resolve => setTimeout(resolve, 300))
                setUsers([
                    { username: 'Alice' },
                    { username: 'Bob' },
                    { username: 'Charlie' },
                    { username: 'Hong Gil-dong' }
                ])
                setLoadingUsers(false)
                return
            }

            const { data, error } = await supabase
                .from('yje_users')
                .select('username')
                .order('username')

            if (error) throw error

            if (data && data.length > 0) {
                setUsers(data)
                setView('list')
            } else {
                setView('create')
            }

        } catch (err) {
            console.error('Error fetching users:', err)
            // Supabase 미연결 시 create 뷰로 fallback (에러 노출 없이 처리)
            setView('create')
        } finally {
            setLoadingUsers(false)
        }
    }

    const handleLogin = async (e: React.FormEvent | string) => {
        if (typeof e !== 'string') {
            e.preventDefault()
        }

        const usernameToLogin = typeof e === 'string' ? e : name

        if (!usernameToLogin.trim()) return

        setSubmitting(true)
        setError('')

        const result = await login(usernameToLogin)

        if (result.success) {
            navigate('/dashboard')
        } else {
            setError(result.error || 'Login failed')
            setSubmitting(false)
        }
    }

    if (loadingUsers) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="bg-gradient-to-r from-sky-500 to-blue-600 p-8 text-center">
                    <h1 className="text-3xl font-bold text-white">연애는 유재은</h1>
                </div>

                <div className="p-8">
                    {view === 'list' && users.length > 0 ? (
                        <div className="space-y-6">
                            <h2 className="text-xl font-semibold text-gray-800 text-center">이름을 선택해주세요</h2>
                            <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto p-1">
                                {users.map((u) => (
                                    <button
                                        key={u.username}
                                        onClick={() => handleLogin(u.username)}
                                        disabled={submitting}
                                        className="p-3 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-xl text-slate-700 font-medium transition-all text-sm truncate"
                                    >
                                        {u.username}
                                    </button>
                                ))}
                            </div>

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t border-gray-200" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-white px-2 text-gray-400">Or</span>
                                </div>
                            </div>

                            <button
                                onClick={() => setView('create')}
                                className="w-full py-3 px-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-all font-medium flex items-center justify-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                새로 가입하기
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleLogin} className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                            {users.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setView('list')}
                                    className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1 mb-2"
                                >
                                    <ArrowLeft className="w-4 h-4" /> 돌아가기
                                </button>
                            )}
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                                    이름을 입력해주세요
                                </label>
                                <input
                                    type="text"
                                    id="name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"

                                    disabled={submitting}
                                    autoFocus
                                />
                                {error && (
                                    <p className="text-red-500 text-sm mt-2">
                                        {error.includes('fetch') || error.includes('Failed')
                                            ? '연결 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
                                            : error}
                                    </p>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={submitting || !name.trim()}
                                className="w-full bg-gray-900 text-white font-semibold py-3 px-4 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
                            >
                                {submitting ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        저널링 시작하기 <ArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </form>
                    )}


                </div>
            </div>

            <div className="mt-8 text-center animate-in fade-in slide-in-from-bottom-2 duration-700 delay-300">
                <a
                    href="https://biz-potential-consulting.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-col items-center gap-1"
                >
                    <span className="text-xs text-slate-400 font-medium">Official Homepage</span>
                    <span className="text-sm text-slate-500 group-hover:text-blue-500 font-bold transition-colors">
                        Business Potential Consulting
                    </span>
                    <div className="w-8 h-0.5 bg-slate-200 group-hover:w-24 group-hover:bg-blue-400 transition-all duration-500"></div>
                </a>
            </div>
        </div>
    )
}

export default Home
