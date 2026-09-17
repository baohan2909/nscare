// zalooa v6.1 (15/09) - FIX Zalo khong tra loi: bo waitUntil, await truc tiep
// NS CARE — Webhook Zalo v2 (Vercel Edge)
// · Nhận follow/unfollow/tin nhắn -> ghi sự kiện + hộp chat
// · Tự lấy TÊN + AVATAR Zalo của khách mới
// · AI TRỰC CHAT: tự trả lời khi hội thoại CHƯA có nhân viên nhận (bật/tắt trong app)
// · Xử lý XONG rồi mới trả 200 (waitUntil bị Vercel Edge hủy giữa chừng)
export const config = { runtime: 'edge' };

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_ID = process.env.ZALO_APP_ID || '';
const APP_SECRET = process.env.ZALO_APP_SECRET || '';
const AI_KEY = process.env.ANTHROPIC_API_KEY || '';

async function rpc(fn, body) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: 'POST',
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', 'Content-Profile': 'care' },
    body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`RPC ${fn} ${r.status}: ${(await r.text()).slice(0, 160)}`);
  const t = await r.text(); return t ? JSON.parse(t) : null;
}
async function db(path, init = {}) {
  return fetch(`${SB_URL}/rest/v1/${path}`, { ...init, headers: {
    apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json',
    'Content-Profile': 'care', 'Accept-Profile': 'care', Prefer: 'return=representation', ...(init.headers || {}) } });
}
async function zaloToken() {
  const [c] = await (await db('zalo_cau_hinh?id=eq.1')).json();
  if (!c?.refresh_token) throw new Error('CHUA_KET_NOI_ZALO');
  if (c.access_token && c.het_han && new Date(c.het_han).getTime() - Date.now() > 5 * 60000) return c.access_token;
  const r = await fetch('https://oauth.zaloapp.com/v4/oa/access_token', { method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', secret_key: APP_SECRET },
    body: new URLSearchParams({ app_id: APP_ID, grant_type: 'refresh_token', refresh_token: c.refresh_token }) });
  const j = await r.json();
  if (!j.access_token) throw new Error('REFRESH_LOI');
  await db('zalo_cau_hinh?id=eq.1', { method: 'PATCH', body: JSON.stringify({
    access_token: j.access_token, refresh_token: j.refresh_token || c.refresh_token,
    het_han: new Date(Date.now() + Number(j.expires_in || 3600) * 1000).toISOString(), cap_nhat_luc: new Date().toISOString() }) });
  return j.access_token;
}

// Lấy tên + avatar Zalo của khách
async function layTenZalo(uid, token) {
  try {
    const r = await fetch('https://openapi.zalo.me/v3.0/oa/user/detail?data=' +
      encodeURIComponent(JSON.stringify({ user_id: uid })), { headers: { access_token: token } });
    const j = await r.json();
    const ten = j?.data?.display_name || j?.data?.name || null;
    const ava = j?.data?.avatar || j?.data?.avatars?.['240'] || null;
    if (j?.error === 0 && (ten || ava)) {
      await rpc('fn_ht_cap_nhat_ten', { p_zalo_user_id: uid, p_ten: ten, p_avatar: ava });
    } else {
      console.error('layTenZalo: Zalo trả', JSON.stringify(j).slice(0, 200));
    }
  } catch (e) { console.error('layTenZalo loi:', e?.message); }
}

// AI trực chat: soạn câu trả lời + gửi + ghi lịch sử
async function aiTraLoi(htId, uid, token) {
  if (!AI_KEY) return;
  try {
    const nl = await rpc('fn_ht_ai_nguyen_lieu', { p_ht: htId });
    if (!nl) return;
    const hoiThoai = (nl.tin || []).map(t => (t.chieu === 'den' ? 'Khách: ' : 'Nón Sơn: ') + t.noi_dung).join('\n');
    const donTxt = (nl.don_gan_nhat || []).map(d =>
      `- Đơn ${d.ma_don || ''} ngày ${String(d.ngay_mua || '').slice(0, 10)}: ${d.san_pham || ''}`).join('\n');
    const prompt = (nl.ai_tri_thuc ? nl.ai_tri_thuc + '\n\n' : '')
      + 'PHONG CÁCH: ' + (nl.ai_phong_cach || 'Thân thiện, chuyên nghiệp, xưng "em" gọi khách "anh/chị".') + '\n'
      + (nl.ai_loi_dan ? nl.ai_loi_dan + '\n' : '')
      + (nl.khach && nl.khach.ten ? 'Tên khách: ' + nl.khach.ten + '\n' : '')
      + (donTxt ? 'Đơn hàng gần đây của khách:\n' + donTxt + '\n' : '')
      + spPrompt(nl)
      + baiHocPrompt(nl)
      + (nl.anh_khach ? 'Khách vừa GỬI MỘT TẤM ẢNH (đính kèm bên dưới). Hãy nhìn ảnh, nhận biết loại nón/mũ (kết, vành, bucket, jacket...), màu và phong cách, rồi tư vấn nhiệt tình + gợi ý mẫu tương tự bên Nón Sơn nếu phù hợp. Nếu không chắc mã chính xác thì mô tả và hỏi thêm khách, KHÔNG bịa mã.\n' : '')
      + 'Trả lời NGẮN GỌN (1-3 câu). Chỉ trả về đúng NỘI DUNG tin nhắn gửi khách — không giải thích, không markdown, không ngoặc kép bao ngoài.\n\n'
      + 'Hội thoại:\n' + hoiThoai + '\nNón Sơn:';
    const noiDung = nl.anh_khach
      ? [{ type: 'image', source: { type: 'url', url: nl.anh_khach } }, { type: 'text', text: prompt }]
      : prompt;
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': AI_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: nl.ai_model || 'claude-haiku-4-5', max_tokens: 400, messages: [{ role: 'user', content: noiDung }] })
    });
    const j = await r.json();
    const textTho = (j.content || []).filter(x => x.type === 'text').map(x => x.text).join('').trim();
    if (!textTho) return;
    const { text, markers } = xuLyText(textTho);
    const g = await fetch('https://openapi.zalo.me/v3.0/oa/message/cs', {
      method: 'POST', headers: { 'Content-Type': 'application/json', access_token: token },
      body: JSON.stringify({ recipient: { user_id: uid }, message: { text } })
    });
    const gj = await g.json().catch(() => ({}));
    const ok = gj.error === 0 || gj.error == null;
    await rpc('fn_ht_ghi_tin_di', { p_hoi_thoai_id: htId, p_noi_dung: text,
      p_nguoi_gui: 'AI', p_trang_thai: ok ? 'da_gui' : 'loi', p_ma_loi: ok ? null : String(gj.error) });

    // ==== GỬI ẢNH theo đúng mã AI đã đánh dấu ====
    const anhDs = await layAnh(markers, nl);
    for (const a of anhDs) {
      const ga = await fetch('https://openapi.zalo.me/v3.0/oa/message/cs', {
        method: 'POST', headers: { 'Content-Type': 'application/json', access_token: token },
        body: JSON.stringify({ recipient: { user_id: uid }, message: { attachment: { type: 'template',
          payload: { template_type: 'media', elements: [{ media_type: 'image', url: a.url }] } } } })
      });
      const gaj = await ga.json().catch(() => ({}));
      const okA = gaj.error === 0 || gaj.error == null;
      await rpc('fn_ht_ghi_tin_di', { p_hoi_thoai_id: htId,
        p_noi_dung: '[Ảnh ' + a.ma + (a.mau ? ' — ' + a.mau : '') + ']',
        p_nguoi_gui: 'AI', p_trang_thai: okA ? 'da_gui' : 'loi',
        p_ma_loi: okA ? null : String(gaj.error), p_anh_url: a.url });
    }
  } catch (e) { console.error('aiTraLoi:', e?.message); }
}

// khối SP liên quan cho prompt AI
// Khối BÀI HỌC đã được quản lý duyệt — dạy AI CÁCH XỬ LÝ (văn phong vẫn theo QUY TẮC)
function baiHocPrompt(nl) {
  const b = nl.bai_hoc || {};
  const nen = Array.isArray(b.nen) ? b.nen : [];
  const tranh = Array.isArray(b.tranh) ? b.tranh : [];
  if (!nen.length && !tranh.length) return '';
  let s = 'BÀI HỌC TỪ THỰC TẾ (quản lý đã duyệt) - áp dụng CÁCH XỬ LÝ, giữ giọng theo QUY TẮC ở trên:\n';
  if (nen.length) s += nen.map(x => '- ' + x).join('\n') + '\n';
  if (tranh.length) s += tranh.map(x => '- ' + x).join('\n') + '\n';
  return s;
}
function spPrompt(nl) {
  const ds = nl.sp_lien_quan || [];
  if (!ds.length) return '';
  const kh = ds.map(s => {
    const mau = (s.mau_co || []).map(m => (m.ma || '') + '=' + (m.ten || '')).join(', ');
    return '· ' + s.ma_sp + (s.loai ? ' (' + s.loai + ')' : '') +
      (s.gia ? ' — giá ' + s.gia + ' nghìn đồng' : '') +
      (s.vong_dau ? ' — vòng đầu ' + s.vong_dau : '') +
      (s.chat_lieu ? '\n  Chất liệu: ' + s.chat_lieu : '') +
      (s.phu_kien ? '\n  Phụ kiện: ' + s.phu_kien : '') +
      (s.cach_giat ? '\n  Cách giặt: ' + s.cach_giat : '') +
      (mau ? '\n  Màu hiện có: ' + mau : '');
  }).join('\n');
  return 'THÔNG TIN SẢN PHẨM LIÊN QUAN (dữ liệu chuẩn từ kho, dùng để tư vấn - giá đơn vị NGHÌN ĐỒNG, ví dụ 1250 = 1.250.000đ):\n' + kh + '\n'
    + 'Khi muốn gửi hình mã nào cho khách, thêm cuối tin dòng [[ANH:MÃ]] hoặc [[ANH:MÃ|màu]] (chỉ với mã có trong danh sách trên). Chỉ gửi khi khách thực sự muốn xem hoặc giúp chốt đơn.\n';
}
// chọn ảnh cần gửi: khách vừa nhắc mã + xin hình/mẫu → tối đa 2 ảnh của SP đầu
// AI đánh dấu [[ANH:MÃ]] / [[ANH:MÃ|màu]] → tách marker, làm sạch chữ (bỏ gạch dài), lấy ảnh đúng mã
function xuLyText(textTho) {
  const markers = [];
  let text = textTho.replace(/\[\[\s*ANH\s*:\s*([^\]]+?)\s*\]\]/gi, (m, g) => {
    const [maRaw, mauRaw] = g.split('|').map(x => (x || '').trim());
    if (maRaw) markers.push({ ma: maRaw.toUpperCase(), mau: mauRaw || null });
    return '';
  });
  text = text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(?<!\*)\*(?!\*)([^*\n]+)\*(?!\*)/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '- ')
    .replace(/[—–]/g, '-')
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return { text: text || 'Dạ em gửi anh/chị tham khảo ạ.', markers };
}
// Lấy ảnh đúng mã AI đánh dấu: tìm trong sp_lien_quan trước, KHÔNG có thì TRA THẲNG KHO
async function layAnh(markers, nl) {
  const sps = nl.sp_lien_quan || [];
  const norm = s => (s || '').replace(/[^A-Z0-9Đ]/g, '');
  const out = [];
  for (const mk of markers) {
    let sp = sps.find(s => s.ma_sp === mk.ma) || sps.find(s => norm(s.ma_sp) === norm(mk.ma));
    let anh = sp ? (sp.anh || []) : null;
    let maSP = sp ? sp.ma_sp : mk.ma;
    if (!anh) {
      const kq = await rpc('fn_sp_tra_cuu', { p_tu_khoa: mk.ma, p_gh: 1 });
      if (Array.isArray(kq) && kq[0]) { anh = kq[0].anh || []; maSP = kq[0].ma_sp || mk.ma; }
    }
    if (!anh || !anh.length) continue;
    if (mk.mau) { const k = anh.filter(a => a.mau && String(a.mau).toLowerCase().includes(mk.mau.toLowerCase())); if (k.length) anh = k; }
    anh.slice(0, 8).forEach(a => out.push({ url: a.url, ma: maSP, mau: a.mau }));
  }
  // khử ảnh trùng URL (không gửi 2 tấm y hệt)
  const seen = new Set();
  return out.filter(a => (a.url && !seen.has(a.url)) ? (seen.add(a.url), true) : false);
}

export default async function handler(req, context) {
  if (req.method === 'GET') return new Response('NS CARE zalo-webhook OK');
  try {
    const b = await req.json().catch(() => ({}));
    const ev = String(b.event_name || '');
    const rows = [];
    if (ev === 'follow') rows.push({ loai: 'follow', zalo_user_id: String(b.follower?.id || '') });
    else if (ev === 'unfollow') rows.push({ loai: 'unfollow', zalo_user_id: String(b.follower?.id || '') });
    else if (ev.startsWith('user_send')) rows.push({ loai: 'nhan_tin', zalo_user_id: String(b.sender?.id || ''), noi_dung: String(b.message?.text || '(hình ảnh/tệp)') });
    if (rows.length) await rpc('fn_sync_zalo_su_kien', { p_rows: rows });

    // OA GỬI TIN (từ app Zalo OA chính thức) -> đồng bộ vào hộp chat, KHÔNG để AI trả lời lại
    if (ev.startsWith('oa_send')) {
      const uid = String(b.recipient?.id || b.user_id_by_app || '');
      const text = String(b.message?.text || '(đã gửi nội dung)');
      if (uid) {
        const nen = (async () => {
          try {
            const [ht] = await (await db(`ht_hoi_thoai?zalo_user_id=eq.${uid}&select=id`)).json();
            if (!ht?.id) return;
            // Chống TRÙNG: nếu 30s gần đây đã có tin 'di' cùng nội dung (do app mình gửi
            // qua gui-ngay hoặc AI), thì bỏ qua — tránh hiện 2 lần.
            const moc = new Date(Date.now() - 30000).toISOString();
            const trung = await (await db(`ht_tin?hoi_thoai_id=eq.${ht.id}&chieu=eq.di&noi_dung=eq.${encodeURIComponent(text)}&tao_luc=gte.${moc}&select=id`)).json();
            if (Array.isArray(trung) && trung.length) return;
            await rpc('fn_ht_ghi_tin_di', { p_hoi_thoai_id: ht.id, p_noi_dung: text,
              p_nguoi_gui: 'OA', p_trang_thai: 'da_gui', p_ma_loi: null, p_anh_url: null });
          } catch (e) { console.error('oa_send:', e?.message); }
        })();
        await nen;
      }
      return Response.json({ ok: true });
    }

    if (ev.startsWith('user_send')) {
      const uid = String(b.sender?.id || '');
      const loai = ev.includes('image') ? 'image' : ev.includes('sticker') ? 'sticker' : 'text';
      const kq = await rpc('fn_ht_nhan_tin', {
        p_uid: uid,
        p_noi_dung: String(b.message?.text || (loai === 'image' ? '[Hình ảnh]' : loai === 'sticker' ? '[Sticker]' : '[Tệp]')),
        p_loai: loai,
        p_anh_url: b.message?.attachments?.[0]?.payload?.url || null,
        p_ten: null, p_kenh: 'zalo', p_mid: b.message?.msg_id || null
      });
      if (kq?.da_trung) return Response.json({ ok: true });   // Zalo gửi lại → bỏ qua
      // AWAIT TRỰC TIẾP: Vercel Edge HỦY việc chạy nền (waitUntil) giữa chừng
      // -> AI không kịp trả lời. Chống trùng đã có p_mid nên await an toàn.
      try {
        const token = await zaloToken();
        if (kq?.thieu_ten) await layTenZalo(uid, token);
        if (kq?.ai_se_tra_loi) await aiTraLoi(kq.ht_id, uid, token);
      } catch (e) { console.error('xu ly tin:', e?.message); }
    }
    return Response.json({ ok: true });
  } catch (e) {
    console.error(e);
    return Response.json({ ok: false, loi: String(e?.message || e) }, { status: 200 });
  }
}
