-- =============================================
-- 유재은 대표님 저널링 DB 스키마 (yje_ 접두사)
-- 기존 biabocunsulting DB와 완전 독립
-- =============================================

-- 1. 사용자 테이블
CREATE TABLE IF NOT EXISTS yje_users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  username text UNIQUE NOT NULL,
  avatar text,
  bg_color text,
  is_column_challenge boolean DEFAULT false,
  aura_index integer DEFAULT 0,   -- 아우라지수 (완료 시마다 +1)
  created_at timestamptz DEFAULT now()
);

-- 2. 기록 테이블 (저널링/가계부/컨텐츠)
CREATE TABLE IF NOT EXISTS yje_journals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES yje_users(id) ON DELETE CASCADE,
  date date NOT NULL,
  type text NOT NULL CHECK (type IN ('journal', 'account', 'content')),
  link text,
  amount numeric,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date, type)
);

-- 3. 인덱스
CREATE INDEX IF NOT EXISTS yje_journals_user_date ON yje_journals(user_id, date);
CREATE INDEX IF NOT EXISTS yje_journals_date ON yje_journals(date);

-- 4. Row Level Security (RLS) - 공개 읽기, 누구나 삽입/수정/삭제
ALTER TABLE yje_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE yje_journals ENABLE ROW LEVEL SECURITY;

-- 모든 사용자 읽기 허용 (커뮤니티로 서로 확인하기 위함)
CREATE POLICY "yje_allow_read_users" ON yje_users FOR SELECT USING (true);
CREATE POLICY "yje_allow_insert_users" ON yje_users FOR INSERT WITH CHECK (true);
CREATE POLICY "yje_allow_update_users" ON yje_users FOR UPDATE USING (true);
CREATE POLICY "yje_allow_delete_users" ON yje_users FOR DELETE USING (true);

CREATE POLICY "yje_allow_read_journals" ON yje_journals FOR SELECT USING (true);
CREATE POLICY "yje_allow_insert_journals" ON yje_journals FOR INSERT WITH CHECK (true);
CREATE POLICY "yje_allow_update_journals" ON yje_journals FOR UPDATE USING (true);
CREATE POLICY "yje_allow_delete_journals" ON yje_journals FOR DELETE USING (true);
