// zalooa — CHƯNG CẤT TRÍ TUỆ: gộp hàng trăm bài học thành cẩm nang cô đọng.
// GHIM vùng Mỹ: Anthropic chặn một số khu vực châu Á -> 403 Request not allowed
export const config = { runtime: 'edge', regions: ['iad1'] };

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AI_KEY = process.env.ANTHROPIC_API_KEY;
const CRON_SECRET = process.env.CRON_SECRET || '';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

const TEN_CHU_DE = {
  hoi_gia: 'khách hỏi giá', chot_don: 'chốt đơn', che_dat: 'khách chê đắt',
  gui_anh: 'gửi hình sản phẩm', doi_tra: 'đổi trả', khieu_nai: 'khiếu nại',
  hoi_size: 'hỏi size', khach_im: 'khách im lặng', khac: 'tình huống khác'
};

function promptChungCat(loai, chuDe, dsBai) {
  const huong = loai === 'nen' ? 'NHỮNG ĐIỀU NÊN LÀM' : 'NHỮNG ĐIỀU CẦN TRÁNH';
  return `Bạn là chuyên gia đào tạo bán hàng cao cấp. Dưới đây là ${dsBai.length} bài học rút ra từ các cuộc tư vấn THẬT của Nón Sơn (chuỗi hơn 200 cửa hàng mũ bảo hiểm và nón vải), thuộc nhóm "${huong}" trong tình huống "${TEN_CHU_DE[chuDe] || chuDe}".

Nhiều bài TRÙNG Ý nhau do rút từ các ca khác nhau. Nhiệm vụ của bạn: GỘP lại thành các NGUYÊN TẮC CỐT LÕI, súc tích, không lặp.

YÊU CẦU BẮT BUỘC:
- Tối đa 8 nguyên tắc. Gộp triệt để các ý trùng lặp, bỏ ý vụn vặt hoặc quá hiển nhiên.
- Mỗi nguyên tắc 1 câu, tối đa 2 câu nếu cần nêu cách làm. Viết ở dạng hướng dẫn hành động rõ ràng.
- Văn phong CHUYÊN NGHIỆP, chuẩn mực, dễ hiểu cho nhân viên bán hàng.
- KHÔNG dùng markdown (không **, không #), KHÔNG dùng gạch dài, KHÔNG đánh số.
- Mỗi nguyên tắc bắt đầu bằng "- " trên một dòng riêng.
- KHÔNG nhắc tên khách, mã sản phẩm cụ thể hay số thứ tự tin nhắn.
- CHỈ trả về danh sách các dòng nguyên tắc, không có lời dẫn hay kết luận.

CÁC BÀI HỌC GỐC:
${dsBai.map(b => '* ' + b).join('\n')}`;
}

async function chungCatNhom(g, model) {
  const ds = await rpc('fn_hoc_cn_bai', { p_loai: g.loai, p_chu_de: g.chu_de });
  const dsBai = Array.isArray(ds) ? ds : [];
  if (!dsBai.length) return;

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': AI_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: model || 'claude-haiku-4-5', max_tokens: 1500,
      messages: [{ role: 'user', content: promptChungCat(g.loai, g.chu_de, dsBai) }] })
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) {
    const e = j?.error || {};
    throw new Error(`AI ${r.status} ${e.type || ''}: ${(e.message || '').slice(0, 140)}`);
  }
  let txt = (j?.content || []).filter(x => x.type === 'text').map(x => x.text).join('').trim();
  // làm sạch: bỏ markdown, gạch dài, chuẩn hoá đầu dòng
  txt = txt.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/^#{1,6}\s+/gm, '')
           .replace(/[—–]/g, '-').replace(/^\s*\d+[.)]\s*/gm, '- ')
           .replace(/^\s*[*•]\s*/gm, '- ').replace(/\n{3,}/g, '\n\n').trim();
  if (!txt) throw new Error('AI trả rỗng');

  await rpc('fn_hoc_cn_luu_phan', { p_nhom: g.nhom, p_loai: g.loai,
    p_chu_de: g.chu_de, p_noi_dung: txt, p_so_bai: dsBai.length });
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

  const t0 = Date.now();
  const model = body.model || 'claude-haiku-4-5';
  let soNhom = 0, loi = null, xong = false, camNang = null;

  try {
    // mỗi lượt xử lý tối đa 3 nhóm song song, dừng trước khi Vercel cắt
    for (let v = 0; v < 6; v++) {
      if (Date.now() - t0 > 10000) break;
      const ds = await rpc('fn_hoc_cn_can_lam', { p_gh: 3 });
      const nhom = Array.isArray(ds) ? ds : [];
      if (!nhom.length) { xong = true; break; }
      await Promise.all(nhom.map(async g => {
        try { await chungCatNhom(g, model); soNhom++; }
        catch (e) { loi = (loi ? loi + ' | ' : '') + `${g.nhom}: ${e?.message}`.slice(0, 160); }
      }));
      if (loi) break;   // có lỗi thì dừng để báo ngay, tránh lặp hỏng
    }

    if (xong) {
      const kq = await rpc('fn_hoc_cn_gop', { p_model: model });
      camNang = kq;
    }
  } catch (e) {
    loi = (loi ? loi + ' | ' : '') + (e?.message || 'loi_khong_ro');
    console.error('hoc-chungcat:', e?.message);
  }

  let conNhom = 0;
  try { conNhom = (await rpc('fn_hoc_cn_can_lam', { p_gh: 999 }) || []).length; } catch (_) {}

  return json({ ok: !loi, so_nhom: soNhom, con_nhom: conNhom, xong,
    cam_nang: camNang, vung: process.env.VERCEL_REGION || '?', loi });
}
