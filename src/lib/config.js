// ============================================================
//  CẤU HÌNH KẾT NỐI SUPABASE — anh điền 2 giá trị dưới đây
//  (Lấy ở Supabase > Project Settings > API)
//  Khoá ANON là khoá công khai an toàn: DB đã khoá cứng RLS,
//  app chỉ chạm được qua các hàm fn_* nên lộ anon key không sao.
// ============================================================
export const SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co'
export const SUPABASE_ANON_KEY = 'YOUR-ANON-KEY'

// Schema đã tạo trong gói SQL nền móng. Đừng đổi.
export const DB_SCHEMA = 'care'

// ============================================================
//  GỌI QUA TỔNG ĐÀI (tuỳ chọn — để '' nếu chỉ gọi tel: bằng SIM)
//  Điền URL Web App của NS_CARE_webhook.gs (Deploy ▸ Web app ▸ /exec)
//  + CALL_TOKEN đã đặt trong Script Properties của webhook đó.
// ============================================================
export const WEBHOOK_APP_URL = ''
export const CALL_TOKEN = ''
