import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

const Footer = () => {
    const [clickCount, setClickCount] = useState(0)
    const [showAdminModal, setShowAdminModal] = useState(false)
    const [password, setPassword] = useState('')
    const { checkAdmin } = useAuth()
    const navigate = useNavigate()

    const handleHiddenClick = () => {
        setClickCount(prev => prev + 1)
        if (clickCount + 1 >= 5) { // 5 clicks to reveal
            setShowAdminModal(true)
            setClickCount(0)
        }
    }

    const handleAdminLogin = (e: React.FormEvent) => {
        e.preventDefault()
        if (checkAdmin(password)) {
            setShowAdminModal(false)
            setPassword('')
            navigate('/admin')
        } else {
            alert('Incorrect password')
        }
    }

    return (
        <footer className="bg-white border-t border-gray-100 py-6 mt-auto">
            <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-500 relative">

                {/* Hidden Admin Trigger Area */}
                <div
                    onClick={handleHiddenClick}
                    className="absolute bottom-0 right-0 p-4 opacity-0 hover:opacity-10 transition-opacity cursor-pointer text-xs"
                >
                    <Lock className="w-3 h-3" />
                </div>
            </div>

            {/* Simple Admin Password Modal */}
            {showAdminModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-sm">
                        <h3 className="text-lg font-bold mb-4">Admin Access</h3>
                        <form onSubmit={handleAdminLogin}>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-2 border rounded-lg mb-4"
                                placeholder="Enter password"
                                autoFocus
                            />
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowAdminModal(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                                >
                                    Access
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </footer>
    )
}

export default Footer
