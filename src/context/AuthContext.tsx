import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { User } from '@/types'

interface AuthContextType {
    user: User | null
    loading: boolean
    login: (name: string) => Promise<{ success: boolean; error?: string }>
    logout: () => void
    updateProfile: (newName: string, newAvatar?: string, newBgColor?: string) => Promise<{ success: boolean; error?: string }>
    updateColumnChallenge: (isChallenge: boolean) => Promise<{ success: boolean; error?: string }>
    isAdmin: boolean
    checkAdmin: (password: string) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const ADMIN_PASSWORD = '123456' // Simple client-side check as requested

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)
    const [isAdmin, setIsAdmin] = useState(false)

    // Load user from localStorage on mount (persistence)
    useEffect(() => {
        const storedUser = localStorage.getItem('yje_journal_user')
        const adminStatus = localStorage.getItem('yje_journal_admin')

        if (storedUser) {
            setUser(JSON.parse(storedUser))
        }
        if (adminStatus === 'true') {
            setIsAdmin(true)
        }
        setLoading(false)
    }, [])

    const login = async (username: string) => {
        try {
            if (!username.trim()) return { success: false, error: 'Name is required' }

            const cleanName = username.trim()

            // MOCK MODE CHECK
            if (import.meta.env.VITE_USE_MOCK === 'true') {
                console.log('Mock Login Mode Active')
                const mockUser: User = {
                    id: 'mock-user-id-' + cleanName,
                    username: cleanName,
                    created_at: new Date().toISOString(),
                    is_column_challenge: false
                }
                setUser(mockUser)
                localStorage.setItem('morning_journal_user', JSON.stringify(mockUser))
                return { success: true }
            }

            // 1. Check if user exists
            let { data: existingUser, error: fetchError } = await supabase
                .from('yje_users')
                .select('*')
                .eq('username', cleanName)
                .single()

            if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "Relation null" (no rows)
                console.error('Login error:', fetchError)
                return { success: false, error: fetchError.message }
            }

            let targetUser = existingUser as User

            // 2. If not exists, create new user
            if (!existingUser) {
                const { data: newUser, error: createError } = await supabase
                    .from('yje_users')
                    .insert([{ username: cleanName, is_column_challenge: false }])
                    .select()
                    .single()

                if (createError) {
                    console.error('Signup error:', createError)
                    return { success: false, error: createError.message }
                }
                targetUser = newUser as User
            }

            // 3. Set state and local storage
            setUser(targetUser)
            localStorage.setItem('yje_journal_user', JSON.stringify(targetUser))
            return { success: true }

        } catch (err) {
            console.error('Unexpected auth error:', err)
            return { success: false, error: 'An unexpected error occurred' }
        }
    }

    const logout = () => {
        setUser(null)
        setIsAdmin(false)
        localStorage.removeItem('yje_journal_user')
        localStorage.removeItem('yje_journal_admin')
    }

    const updateProfile = async (newName: string, newAvatar?: string, newBgColor?: string) => {
        try {
            if (!user) return { success: false, error: 'Not logged in' }
            if (!newName.trim()) return { success: false, error: 'Name cannot be empty' }

            const cleanName = newName.trim()
            const updates: any = { username: cleanName }
            if (newAvatar) updates.avatar = newAvatar
            if (newBgColor) updates.bg_color = newBgColor

            // MOCK MODE
            if (import.meta.env.VITE_USE_MOCK === 'true') {
                const updatedUser: User = { ...user, ...updates }
                setUser(updatedUser)
                localStorage.setItem('morning_journal_user', JSON.stringify(updatedUser))
                return { success: true }
            }

            const { error } = await supabase
                .from('yje_users')
                .update(updates)
                .eq('id', user.id)

            if (error) {
                if (error.code === '23505') { // Unique violation
                    return { success: false, error: 'Name already taken' }
                }
                throw error
            }

            const updatedUser: User = { ...user, ...updates }
            setUser(updatedUser)
            localStorage.setItem('yje_journal_user', JSON.stringify(updatedUser))
            return { success: true }

        } catch (err: any) {
            console.error('Update profile error:', err)
            return { success: false, error: err.message || 'Failed to update profile' }
        }
    }

    const updateColumnChallenge = async (isChallenge: boolean) => {
        try {
            if (!user) return { success: false, error: 'Not logged in' }

            if (import.meta.env.VITE_USE_MOCK === 'true') {
                const updatedUser: User = { ...user, is_column_challenge: isChallenge }
                setUser(updatedUser)
                localStorage.setItem('morning_journal_user', JSON.stringify(updatedUser))
                return { success: true }
            }

            const { error } = await supabase
                .from('yje_users')
                .update({ is_column_challenge: isChallenge })
                .eq('id', user.id)

            if (error) throw error

            const updatedUser: User = { ...user, is_column_challenge: isChallenge }
            setUser(updatedUser)
            localStorage.setItem('yje_journal_user', JSON.stringify(updatedUser))
            return { success: true }

        } catch (err: any) {
            console.error('Update challenge error:', err)
            return { success: false, error: err.message || 'Failed to update challenge' }
        }
    }

    const checkAdmin = (password: string) => {
        if (password === ADMIN_PASSWORD) {
            setIsAdmin(true)
            localStorage.setItem('yje_journal_admin', 'true')
            return true
        }
        return false
    }

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, updateProfile, updateColumnChallenge, isAdmin, checkAdmin }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
