// zalooa v6.2 (16/09) - them TikTok: oauth + webhook (hang doi, tra 200 trong 3s)
// NS CARE — Webhook TikTok Shop (Customer Service).
// TikTok bắt trả 200 trong 3 GIÂY -> chỉ ghi tin + cất hàng đợi, KHÔNG gọi AI ở đây.
// Bộ chạy riêng (tiktok-runner) sẽ lấy hàng đợi, gọi AI và gửi trả.
export const config = { runtime: 'edge', regions: ['iad1'] };

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_KEY = process.env.TIKTOK_APP_KEY || '';
const APP_SECRET = process.env.TIKTOK_APP_SECRET || '';

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

// TikTok ký bằng HMAC-SHA256: app_key + body, khoá là app_secret, bọc 2 đầu bằng secret
async function kiemChuKy(thoBody, chuKy) {
  if (!APP_SECRET || !chuKy) return true;   // chưa đặt secret thì bỏ qua để test
  try {
    const chuoi = APP_SECRET + APP_KEY + thoBody + APP_SECRET;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(APP_SECRET),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(chuoi));
    const hex = [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
    return hex === String(chuKy).toLowerCase();
  } catch (_) { return true; }
}

export default async function handler(req) {
  // TikTok có thể gọi GET để kiểm tra đường dẫn sống
  if (req.method === 'GET') return new Response('ok');

  const thoBody = await req.text().catch(() => '');
  let b = null;
  try { b = JSON.parse(thoBody); } catch (_) { return Response.json({ code: 0 }); }

  const chuKy = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  const hopLe = await kiemChuKy(thoBody, chuKy);
  console.log('TT payload:', thoBody.slice(0, 600), '| chu ky hop le:', hopLe);
  if (!hopLe) return Response.json({ code: 0 });   // vẫn trả 200 để TikTok khỏi gửi lại

  try {
    // Sự kiện 14 = tin nhắn mới trong chat TikTok Shop
    const loaiSK = b.type ?? b.event_type ?? null;
    const d = b.data || {};
    if (Number(loaiSK) === 14 || d.conversation_id) {
      const nguoiGui = d.sender || d.from || {};
      const vaiTro = String(nguoiGui.role || nguoiGui.sender_role || '').toUpperCase();
      // bỏ qua tin do chính shop gửi (tránh AI tự trả lời chính mình)
      if (vaiTro === 'SELLER' || vaiTro === 'SHOP') return Response.json({ code: 0 });

      const uid = String(nguoiGui.user_id || nguoiGui.id || d.conversation_id || '');
      const text = d.content?.content || d.content?.text || d.text || '';
      const anh = d.content?.image_url || null;
      const loai = anh ? 'image' : (text ? 'text' : 'khac');
      if (!uid) return Response.json({ code: 0 });

      const kq = await rpc('fn_ht_nhan_tin', {
        p_uid: uid,
        p_noi_dung: text || (anh ? '[Hình ảnh]' : '[Nội dung khác]'),
        p_loai: loai,
        p_anh_url: anh,
        p_ten: nguoiGui.nickname || nguoiGui.name || null,
        p_kenh: 'tiktok_shop',
        p_mid: d.message_id || null,
        p_tt_conv: d.conversation_id || null,
        p_tt_shop: String(b.shop_id || d.shop_id || ''),
        p_tt_video: null
      });
      console.log('TT nhan tin:', JSON.stringify(kq));

      // Cất hàng đợi để bộ chạy riêng gọi AI (KHÔNG gọi AI ở đây vì chỉ có 3 giây)
      if (kq?.ai_se_tra_loi && !kq?.da_trung) {
        await rpc('fn_hd_them', {
          p_ht: kq.ht_id, p_kenh: 'tiktok_shop', p_uid: uid,
          p_tham_chieu: { conversation_id: d.conversation_id || null }
        });
      }
    }
  } catch (e) {
    console.error('tiktok-webhook:', e?.message);
  }

  return Response.json({ code: 0 });   // TikTok coi code 0 là đã nhận
}
