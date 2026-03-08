import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Search, ExternalLink, Loader2, ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Link } from 'react-router-dom'

interface AdminJournal {
    id: string
    date: string
    type: string
    link: string
    amount: number | null
    created_at: string
    yje_users: {
        username: string
    }
}

const Admin = () => {
    const [journals, setJournals] = useState<AdminJournal[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        fetchJournals()
    }, [])

    const fetchJournals = async () => {
        try {
            const { data, error } = await supabase
                .from('yje_journals')
                .select(`
                    id,
                    date,
                    type,
                    link,
                    amount,
                    created_at,
                    yje_users (
                        username
                    )
                `)
                .order('date', { ascending: false })
                .order('created_at', { ascending: false })

            if (error) throw error

            // @ts-ignore
            setJournals(data || [])
        } catch (error) {
            console.error('Error fetching journals:', error)
        } finally {
            setLoading(false)
        }
    }

    const filteredJournals = journals.filter(j =>
        j.yje_users?.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        j.date.includes(searchTerm) ||
        j.type.includes(searchTerm)
    )

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <Link to="/dashboard" className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1 mb-2">
                        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-900">
                        Admin Dashboard
                    </h1>
                    <p className="text-gray-500 text-sm">
                        View all submissions.
                    </p>
                </div>

                <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search student, date, or type..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all"
                    />
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4">User</th>
                                <th className="px-6 py-4">Type</th>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Value / Link</th>
                                <th className="px-6 py-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredJournals.map((journal) => (
                                <tr key={journal.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-gray-900">
                                        {journal.yje_users?.username || 'Unknown'}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="bg-slate-100 px-2 py-1 rounded text-xs font-bold uppercase">{journal.type}</span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">
                                        {format(new Date(journal.date), 'MMMM d, yyyy')}
                                    </td>
                                    <td className="px-6 py-4 text-gray-400 text-xs">
                                        {journal.type === 'account' ? (
                                            <span className="text-slate-900 font-bold">₩{journal.amount?.toLocaleString()}</span>
                                        ) : (
                                            <span className="truncate max-w-[150px] inline-block">{journal.link}</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {journal.type !== 'account' && journal.link && journal.link !== 'completed' && (
                                            <a
                                                href={journal.link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium hover:underline"
                                            >
                                                View <ExternalLink className="w-3 h-3" />
                                            </a>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {filteredJournals.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                                        No journals found matching your search.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

export default Admin
