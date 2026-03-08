import React, { useState, useEffect } from 'react'
import { X, Link as LinkIcon, Send, Calendar as CalendarIcon, CheckCircle } from 'lucide-react'
import { format } from 'date-fns'
import { SubmissionType, SUBMISSION_TYPES } from '@/types'

interface SubmissionModalProps {
    isOpen: boolean
    onClose: () => void
    date: Date
    onSubmit: (data: { link: string, type: SubmissionType, amount?: number }) => Promise<void>
    submittedTypes: SubmissionType[]
    existingData: Record<string, { link: string, amount: number | null }>
    defaultType?: SubmissionType
    isAdminViewing?: boolean
}

const SubmissionModal = ({ isOpen, onClose, date, onSubmit, submittedTypes, existingData, defaultType, isAdminViewing = false }: SubmissionModalProps) => {
    const [selectedType, setSelectedType] = useState<SubmissionType>(defaultType || 'journal')
    const [link, setLink] = useState('')
    const [amount, setAmount] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const prefillForType = (type: SubmissionType) => {
        const existing = existingData[type]
        if (existing) {
            if (type === 'account') {
                setAmount(existing.amount != null ? String(existing.amount) : '')
            } else {
                setLink(existing.link || '')
            }
        } else {
            setLink('')
            setAmount('')
        }
    }

    useEffect(() => {
        if (isOpen) {
            const startType = defaultType || 'journal'
            setSelectedType(startType)
            setIsSubmitting(false)
            prefillForType(startType)
        }
    }, [isOpen])

    if (!isOpen) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const isCurrentlySubmitted = submittedTypes.includes(selectedType)

        // 신규 제출인데 값이 없으면 리턴
        if (!isCurrentlySubmitted) {
            if (selectedType === 'account' && !amount) return
            if ((selectedType === 'journal' || selectedType === 'content') && !link.trim()) return
        }

        setIsSubmitting(true)

        let contentToSubmit = link.trim()
        let finalAmount = selectedType === 'account' ? (amount ? parseInt(amount.replace(/,/g, ''), 10) : undefined) : undefined

        // 기존 제출된 항목인데 값을 비워서 보내면 삭제(unchecked) 처리
        if (isCurrentlySubmitted) {
            if (selectedType === 'account' && !amount && amount !== '0') {
                contentToSubmit = 'unchecked'
            } else if ((selectedType === 'journal' || selectedType === 'content') && !link.trim()) {
                contentToSubmit = 'unchecked'
            }
        }

        await onSubmit({
            type: selectedType,
            link: contentToSubmit,
            amount: finalAmount
        })

        setIsSubmitting(false)
        onClose()
    }

    const isSubmitted = submittedTypes.includes(selectedType)

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <CalendarIcon className="w-5 h-5 text-blue-500" />
                        {isAdminViewing ? '기록 보기' : '기록하기'} <span className="text-slate-400 text-sm font-normal">| {format(date, 'MM.dd')}</span>
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-200 transition-colors text-slate-500">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* 타입 선택 탭 */}
                <div className="p-4 bg-white border-b border-slate-100 shrink-0">
                    <div className="flex gap-2">
                        {SUBMISSION_TYPES.map(type => {
                            const isDone = submittedTypes.includes(type.id)
                            const isSelected = selectedType === type.id
                            return (
                                <button
                                    key={type.id}
                                    onClick={() => { setSelectedType(type.id); prefillForType(type.id) }}
                                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border flex items-center gap-1.5 ${isSelected
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-200'
                                        : isDone
                                            ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                        }`}
                                >
                                    {isDone && <CheckCircle className="w-3.5 h-3.5" />}
                                    {type.label}
                                </button>
                            )
                        })}
                    </div>
                </div>

                <div className="p-6 overflow-y-auto">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* 저널링 / 컨텐츠: 링크 입력 */}
                        {(selectedType === 'journal' || selectedType === 'content') && (
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">
                                    {selectedType === 'journal' ? '저널링 링크' : '컨텐츠 링크'} (URL)
                                </label>
                                <div className="relative">
                                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="url"
                                        value={link}
                                        onChange={(e) => setLink(e.target.value)}
                                        placeholder="https://..."
                                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                                        required={!isSubmitted}
                                        autoFocus
                                        readOnly={isAdminViewing}
                                    />
                                </div>
                            </div>
                        )}

                        {/* 가계부: 금액 입력 */}
                        {selectedType === 'account' && (
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">오늘 사용한 금액</label>
                                <div className="relative">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">₩</div>
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        placeholder="금액 입력"
                                        className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-bold text-lg"
                                        required={!isSubmitted}
                                        autoFocus
                                        readOnly={isAdminViewing}
                                    />
                                </div>
                            </div>
                        )}

                        {!isAdminViewing && (
                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full py-3.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSubmitting ? '저장 중...' : isSubmitted ? '수정하기 ✏️' : '기록하기'} <Send className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </form>
                </div>
            </div>
        </div>
    )
}

export default SubmissionModal
