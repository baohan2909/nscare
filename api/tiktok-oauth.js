// NS CARE — Callback ủy quyền TikTok Shop. Nhận ?code -> đổi lấy token -> lưu Supabase.
// GHIM vùng Mỹ cho đồng bộ với các hàm khác.
export const config = { runtime: 'edge', regions: ['iad1'] };

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_KEY = process.env.TIKTOK_APP_KEY || '';
const APP_SECRET = process.env.TIKTOK_APP_SECRET || '';

async function db(path, init = {}) {
  return fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      'Content-Profile': 'care', 'Accept-Profile': 'care',
      Prefer: 'return=representation', ...(init.headers || {})
    }
  });
}

function html(tieu, mo, ok = true) {
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
     <div style="font-family:system-ui;max-width:520px;margin:70px auto;text-align:center;padding:0 20px">
       <div style="font-size:44px">${ok ? '🎉' : '⚠️'}</div>
       <div style="font-size:21px;font-weight:800;color:#14213A;margin:10px 0">${tieu}</div>
       <p style="color:#4A5670;line-height:1.65">${mo}</p></div>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export default async function handler(req) {
  try {
    if (!APP_KEY || !APP_SECRET) {
      return html('Chưa cấu hình', 'Thiếu TIKTOK_APP_KEY / TIKTOK_APP_SECRET trong Environment Variables của Vercel.', false);
    }
    const url = new URL(req.url);
    const code = url.searchParams.get('code') || url.searchParams.get('auth_code') || '';
    if (!code) return html('Thiếu mã uỷ quyền', 'Không nhận được mã từ TikTok. Bấm lại nút uỷ quyền từ đầu.', false);

    // 1) Đổi mã uỷ quyền lấy access token
    const tk = await fetch('https://auth.tiktok-shops.com/api/v2/token/get?' + new URLSearchParams({
      app_key: APP_KEY, app_secret: APP_SECRET, auth_code: code, grant_type: 'authorized_code'
    }), { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    const j = await tk.json().catch(() => null);
    const d = j?.data || {};
    if (!d.access_token) {
      return html('TikTok từ chối', 'Chi tiết: ' + JSON.stringify(j || {}).slice(0, 400), false);
    }

    // 2) Lấy cửa hàng đã uỷ quyền — BẮT BUỘC ký HMAC như mọi API TikTok Shop
    let shopId = null, shopTen = null, shopCipher = null;
    try {
      const duongDan = '/authorization/202309/shops';
      const thamSo = { app_key: APP_KEY, timestamp: String(Math.floor(Date.now() / 1000)) };
      const keys = Object.keys(thamSo).sort();
      let chuoi = APP_SECRET + duongDan + keys.map(k => k + thamSo[k]).join('') + APP_SECRET;
      const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(APP_SECRET),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(chuoi));
      thamSo.sign = [...new Uint8Array(sig)].map(x => x.toString(16).padStart(2, '0')).join('');

      const sh = await fetch('https://open-api.tiktokglobalshop.com' + duongDan + '?' + new URLSearchParams(thamSo), {
        headers: { 'x-tts-access-token': d.access_token, 'Content-Type': 'application/json' }
      }).then(r => r.json());
      const s = sh?.data?.shops?.[0];
      if (s) { shopId = s.id || null; shopTen = s.name || null; shopCipher = s.cipher || null; }
    } catch (_) { /* không chặn luồng, có endpoint /tiktok-shop lấy lại sau */ }

    // 3) Lưu lại
    await db('tt_cau_hinh?id=eq.1', {
      method: 'PATCH',
      body: JSON.stringify({
        access_token: d.access_token,
        refresh_token: d.refresh_token || null,
        het_han: d.access_token_expire_in
          ? new Date(Number(d.access_token_expire_in) * 1000).toISOString() : null,
        refresh_het_han: d.refresh_token_expire_in
          ? new Date(Number(d.refresh_token_expire_in) * 1000).toISOString() : null,
        shop_id: shopId, shop_ten: shopTen, shop_cipher: shopCipher,
        cap_nhat_luc: new Date().toISOString()
      })
    });

    return html('Kết nối TikTok Shop thành công!',
      (shopTen ? `Cửa hàng <b>${shopTen}</b> đã sẵn sàng. ` : '') +
      'Anh đóng tab này và quay lại NS CARE.');
  } catch (e) {
    return html('Lỗi', String(e?.message || e), false);
  }
}
