export interface User {
    id: string;
    username: string;
    avatar?: string;
    bg_color?: string;
    is_column_challenge: boolean;
    aura_index?: number;
    created_at?: string;
}

export type SubmissionType = 'journal' | 'account' | 'content';

export interface DailySubmission {
    id: string;
    user_id: string;
    date: string;
    type: SubmissionType;
    content?: string;
    amount?: number;
    created_at: string;
}

export const SUBMISSION_TYPES: { id: SubmissionType; label: string; icon?: string }[] = [
    { id: 'journal', label: '저널링' },
    { id: 'account', label: '가계부' },
    { id: 'content', label: '컨텐츠' },
];
