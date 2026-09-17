// zalooa v6.3 (17/09) - FIX chu ky HMAC TikTok + endpoint /tiktok-shop lay shop_cipher
// NS CARE — Lấy thông tin cửa hàng TikTok Shop (shop_id + shop_cipher).
// Mọi API TikTok Shop đều BẮT BUỘC ký HMAC-SHA256 trên từng lệnh gọi.
export const config = { runtime: 'edge', regions: ['iad1'] };

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_KEY = process.env.TIKTOK_APP_KEY || '';
const APP_SECRET = process.env.TIKTOK_APP_SECRET || '';
const CRON_SECRET = process.env.CRON_SECRET || '';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
               'Access-Control-Allow-Headers': 'content-type, x-cron-secret' };
const json = (o, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', ...CORS } });

async function rpc(fn, body) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json', 'Content-Profile': 'care' },
    body: JSON.stringify(body || {})
  });
  if (!r.ok) throw new Error(`RPC ${fn} ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const t = await r.text(); return t ? JSON.parse(t) : null;
}
async function db(path, init = {}) {
  return fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      'Content-Profile': 'care', 'Accept-Profile': 'care',
      Prefer: 'return=representation', ...(init.headers || {}) }
  });
}

// ---- CHỮ KÝ TIKTOK SHOP ----
// Ghép: app_secret + đường_dẫn + (key+value đã sắp xếp, bỏ sign & access_token) + body + app_secret
// rồi HMAC-SHA256 với khoá là app_secret, xuất hex.
async function kySign(duongDan, thamSo, thoBody = '') {
  const keys = Object.keys(thamSo).filter(k => k !== 'sign' && k !== 'access_token').sort();
  let chuoi = duongDan + keys.map(k => k + thamSo[k]).join('');
  if (thoBody) chuoi += thoBody;
  chuoi = APP_SECRET + chuoi + APP_SECRET;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(APP_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(chuoi));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Gọi API TikTok Shop có ký đầy đủ
export async function goiTikTok(duongDan, token, thamSoThem = {}, method = 'GET', body = null) {
  const thoBody = body ? JSON.stringify(body) : '';
  const thamSo = { app_key: APP_KEY, timestamp: String(Math.floor(Date.now() / 1000)), ...thamSoThem };
  thamSo.sign = await kySign(duongDan, thamSo, thoBody);
  const url = 'https://open-api.tiktokglobalshop.com' + duongDan + '?' + new URLSearchParams(thamSo);
  const r = await fetch(url, {
    method,
    headers: { 'x-tts-access-token': token, 'Content-Type': 'application/json' },
    ...(thoBody ? { body: thoBody } : {})
  });
  return r.json().catch(() => null);
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));
  const bimat = req.headers.get('x-cron-secret') || url.searchParams.get('key') || '';
  let duocPhep = !!CRON_SECRET && bimat === CRON_SECRET;
  if (!duocPhep && body.token) {
    try { duocPhep = !!(await rpc('fn_phien_ma', { p_token: body.token })); }
    catch (_) { duocPhep = false; }
  }
  if (!duocPhep) return json({ ok: false, loi: 'KHONG_CO_QUYEN' }, 401);

  if (!APP_KEY || !APP_SECRET) return json({ ok: false, loi: 'THIEU_APP_KEY_HOAC_SECRET' });

  try {
    // lấy access token đang lưu
    const cf = await (await db('tt_cau_hinh?id=eq.1&select=access_token')).json();
    const token = Array.isArray(cf) && cf[0] ? cf[0].access_token : null;
    if (!token) return json({ ok: false, loi: 'CHUA_CO_ACCESS_TOKEN - can uy quyen lai' });

    const kq = await goiTikTok('/authorization/202309/shops', token);
    const shops = kq?.data?.shops || [];
    if (!shops.length) {
      return json({ ok: false, loi: 'TIKTOK_KHONG_TRA_VE_SHOP', chi_tiet: JSON.stringify(kq || {}).slice(0, 500) });
    }
    const s = shops[0];
    await db('tt_cau_hinh?id=eq.1', {
      method: 'PATCH',
      body: JSON.stringify({
        shop_id: s.id || null, shop_ten: s.name || null, shop_cipher: s.cipher || null,
        cap_nhat_luc: new Date().toISOString()
      })
    });
    return json({ ok: true, shop_id: s.id, shop_ten: s.name, co_cipher: !!s.cipher, so_shop: shops.length });
  } catch (e) {
    return json({ ok: false, loi: String(e?.message || e) });
  }
}
