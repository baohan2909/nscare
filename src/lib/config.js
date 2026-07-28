// ============================================================
//  CẤU HÌNH KẾT NỐI SUPABASE
//  Khoá ANON là khoá công khai an toàn: DB đã khoá cứng RLS,
//  app chỉ chạm được qua các hàm fn_* nên lộ anon key không sao.
// ============================================================
export const SUPABASE_URL = 'https://huqpvmrvssrwtueyonjj.supabase.co'
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cXB2bXJ2c3Nyd3R1ZXlvbmpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwMjQ3MTIsImV4cCI6MjEwMDYwMDcxMn0.SiXU4_p8iHKYH8-fTRvYbII3NAqqyxtKKeu_hYpCKwQ'

// Schema đã tạo trong gói SQL nền móng. Đừng đổi.
export const DB_SCHEMA = 'care'

// ============================================================
//  GỌI QUA TỔNG ĐÀI (tuỳ chọn — để '' nếu chỉ gọi tel: bằng SIM)
//  Điền URL Web App của NS_CARE_webhook.gs (Deploy ▸ Web app ▸ /exec)
//  + CALL_TOKEN đã đặt trong Script Properties của webhook đó.
// ============================================================
export const WEBHOOK_APP_URL = 'https://script.google.com/macros/s/AKfycbwtQrgpYeAWFKe5p2fwh1l05i2gROhkTWjCcU2twYZPRwrl-Dq_6UwG2KXnQZeqkTY/exec'
export const CALL_TOKEN = ''

export const APP_VERSION = '4.0.0'

export const ZALO_GW_URL = 'https://oa.nonson.com.vn'
