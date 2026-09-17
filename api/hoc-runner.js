// zalooa v5.9 (15/09) - cham song song 4 ca + ngan sach 10s + tu duyet (auto 100%)
// NS CARE — BỘ HỌC TẬP: chuyên gia AI chấm hội thoại thật, rút bài học.
// Gọi bởi Vercel Cron (ban đêm) hoặc nút "Học ngay" trên app.
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

// ---------------------------------------------------------------------
//  PROMPT CHUYÊN GIA — phần quan trọng nhất của cả hệ thống
// ---------------------------------------------------------------------
function promptChuyenGia(ht, quyTac) {
  const hoiThoai = (ht.tin || []).map(t => {
    const ai = t.ai === 'KHACH' ? 'KHÁCH' : (t.ai === 'NS_AI' ? 'NÓN SƠN (AI)' : 'NÓN SƠN (NV)');
    const nd = t.loai === 'image' ? '[khách gửi hình]' : (t.noi_dung || '');
    return `[${t.i}] ${ai}: ${nd}`;
  }).join('\n');

  const tinHieu = [
    ht.co_don ? '- Có đơn hàng phát sinh quanh thời điểm chat (tín hiệu THÀNH CÔNG mạnh).' : '',
    ht.khach_im_cuoi ? '- Tin cuối là phía Nón Sơn, khách không trả lời nữa (nghi khách bỏ đi).' : '',
    `- Kênh: ${ht.kenh === 'facebook' ? 'Facebook Messenger' : 'Zalo OA'}; tổng ${ht.so_tin} tin, khách gửi ${ht.so_tin_khach} tin.`
  ].filter(Boolean).join('\n');

  return `Bạn là CHUYÊN GIA TƯ VẤN BÁN HÀNG & CHĂM SÓC KHÁCH HÀNG HÀNG ĐẦU THẾ GIỚI, 20 năm trong ngành bán lẻ thời trang cao cấp, am hiểu sâu tâm lý khách hàng Việt Nam. Bạn đang huấn luyện đội tư vấn của Nón Sơn (chuỗi hơn 200 cửa hàng mũ bảo hiểm và nón vải).

NHIỆM VỤ: đọc một hội thoại THẬT giữa khách và Nón Sơn, đánh giá chất lượng tư vấn, rút ra BÀI HỌC áp dụng được cho những ca sau.

QUY TẮC NGHIỆP VỤ NÓN SƠN (dùng để chấm đúng/sai, KHÔNG phải để chấm câu chữ):
${(quyTac || '').slice(0, 3000)}

CHUẨN ĐÁNH GIÁ - "LẼ PHẢI" (theo thứ tự quan trọng):
1. ĐÚNG SỰ THẬT: không bịa mã sản phẩm, giá, chính sách; không hứa điều không có.
2. ĐÚNG NGHIỆP VỤ: đúng quy tắc Nón Sơn ở trên.
3. TỬ TẾ VÀ TÔN TRỌNG: không thao túng, không ép mua, không nói xấu đối thủ, không khơi vào mặc cảm của khách.
4. HIỆU QUẢ BÁN HÀNG: gợi đúng nhu cầu, xử lý được băn khoăn, dẫn dắt tới quyết định một cách tinh tế.

RẤT QUAN TRỌNG - ĐÂY LÀ NGUYÊN TẮC BẤT DI BẤT DỊCH:
1. HỌC ĐIỀU ĐÚNG ĐẮN, KHÔNG HỌC VĂN PHONG. Bài học phải là NGUYÊN TẮC XỬ LÝ ĐÚNG (làm gì, theo trình tự nào, xác nhận điều gì trước khi cam kết), TUYỆT ĐỐI KHÔNG phải cách dùng từ hay giọng điệu.
2. TUYỆT ĐỐI KHÔNG học theo câu chữ của nhân viên trong hội thoại - nhân viên có thể viết cẩu thả, sai chính tả, thiếu chuyên nghiệp. Bạn CHỈ rút ra điều đúng về mặt NGHIỆP VỤ và ĐẠO LÝ.
3. Xác định ĐÚNG/SAI dựa trên SỰ THẬT và KẾT QUẢ THỰC TẾ: điều gì dẫn tới khách hài lòng và mua hàng thì là đúng; điều gì làm khách mất niềm tin, bỏ đi, hoặc khiến Nón Sơn hứa sai thì là sai. Không phán theo cảm tính.
4. "cau_tra_loi_mau" PHẢI viết bằng VĂN PHONG CHUYÊN NGHIỆP CHUẨN MỰC của Nón Sơn theo QUY TẮC ở trên (xưng "em", gọi "anh/chị", lịch sự, ấm áp, không markdown, không gạch dài, không từ tiêu cực). Đây là câu mẫu để nhân viên noi theo nên phải hoàn hảo.
5. Bài học TỔNG QUÁT HOÁ: KHÔNG nhắc tên khách, KHÔNG nhắc mã sản phẩm cụ thể, KHÔNG nhắc số tin.
6. Bài học TỐI ĐA 2 CÂU, CHỈ MỘT loại: hoặc bắt đầu "NÊN:" hoặc bắt đầu "TRÁNH:" - KHÔNG gộp cả hai vào một bài.
7. Ca THẤT BẠI BẮT BUỘC có "loi_sai" chỉ rõ sai ở đâu + "cau_tra_loi_mau" viết lại chuẩn mực.
8. Nếu hội thoại vô nghĩa (spam, chỉ chào hỏi, sticker, không có nội dung tư vấn) thì đặt "dang_hoc": false và bỏ trống các trường phân tích.
9. "chu_de" CHỈ được chọn đúng một trong các giá trị cho sẵn, không tự đặt giá trị khác.

TÍN HIỆU HỆ THỐNG TỰ ĐOÁN (tham khảo, bạn tự quyết định cuối cùng):
${tinHieu}

HỘI THOẠI CẦN CHẤM:
${hoiThoai}

CHỈ TRẢ VỀ MỘT KHỐI JSON THUẦN (không markdown, không giải thích ngoài JSON) theo đúng cấu trúc:
{
  "dang_hoc": true,
  "ket_qua": "thanh_cong" | "that_bai" | "khong_ro",
  "ly_do_ket_qua": "vì sao xếp loại vậy, 1 câu",
  "diem": 0-10,
  "tom_tat": "khách cần gì và diễn biến, 2-3 câu",
  "chu_de": "hoi_gia" | "chot_don" | "che_dat" | "gui_anh" | "doi_tra" | "khieu_nai" | "hoi_size" | "khach_im" | "khac",
  "nuoc_di_hay": "ca thành công: điểm tư vấn làm tốt (để trống nếu thất bại)",
  "loi_sai": "ca thất bại: sai ở đâu (để trống nếu thành công)",
  "cau_tra_loi_mau": "viết lại câu trả lời chuẩn mực cho điểm mấu chốt",
  "bai_hoc": "NÊN: ... hoặc TRÁNH: ... (tối đa 2 câu)",
  "loai_bai_hoc": "nen" | "tranh",
  "dan_chung": [số thứ tự các tin then chốt, tối đa 8 số]
}`;
}

function docJSON(txt) {
  if (!txt) return null;
  let s = txt.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const d = s.indexOf('{'), c = s.lastIndexOf('}');
  if (d < 0 || c < 0) return null;
  try { return JSON.parse(s.slice(d, c + 1)); } catch (_) { return null; }
}

async function chamMotCa(ht, quyTac, model) {
  if (!AI_KEY) throw new Error('CHUA_CO_ANTHROPIC_API_KEY tren Vercel');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': AI_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: model || 'claude-sonnet-5',
      max_tokens: 1200,
      messages: [{ role: 'user', content: promptChuyenGia(ht, quyTac) }]
    })
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) {
    const e = j?.error || {};
    throw new Error(`AI ${r.status} ${e.type || ''}: ${(e.message || '').slice(0, 160)}`);
  }
  const txt = (j?.content || []).filter(x => x.type === 'text').map(x => x.text).join('');
  if (!txt) throw new Error('AI rỗng: ' + JSON.stringify(j?.error || {}).slice(0, 200));
  const kq = docJSON(txt);
  if (!kq) throw new Error('Không đọc được JSON: ' + txt.slice(0, 200));
  return kq;
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const url = new URL(req.url);
  const nguon = url.searchParams.get('nguon') || 'cron';
  const body = await req.json().catch(() => ({}));

  // Xác thực 2 đường: (a) pg_cron gửi x-cron-secret, (b) app gửi token nhân viên
  const bimat = req.headers.get('x-cron-secret') || url.searchParams.get('key') || '';
  let duocPhep = !!CRON_SECRET && bimat === CRON_SECRET;
  if (!duocPhep && body.token) {
    // fn_phien_ma trả mã nhân viên nếu token hợp lệ + đủ quyền quản lý, sai thì báo lỗi
    try { duocPhep = !!(await rpc('fn_phien_ma', { p_token: body.token })); }
    catch (_) { duocPhep = false; }
  }
  if (!duocPhep) return json({ ok: false, loi: 'KHONG_CO_QUYEN' }, 401);

  // ?kiemtra=1 → gọi thử Anthropic 1 câu ngắn, trả nguyên văn lỗi để chẩn đoán
  if (url.searchParams.get('kiemtra')) {
    if (!AI_KEY) return json({ ok: false, loi: 'CHUA_CO_ANTHROPIC_API_KEY' });
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': AI_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 20,
        messages: [{ role: 'user', content: 'Xin chào' }] })
    });
    const j = await r.json().catch(() => null);
    return json({ ok: r.ok, http: r.status, vung: process.env.VERCEL_REGION || '?',
      tra_loi: r.ok ? (j?.content?.[0]?.text || '').slice(0, 60) : null,
      loi: r.ok ? null : JSON.stringify(j?.error || j).slice(0, 400) });
  }

  const t0 = Date.now();
  let lo = null, soCham = 0, soBai = 0, loi = null, soUngVien = 0, hetGio = false;
  try {
    const mo = await rpc('fn_hoc_lo_mo', { p_nguon: nguon });
    if (!mo?.chay) return json({ ok: true, chay: false, ly_do: mo?.ly_do });
    lo = mo.lo_id;

    // quy tắc nghiệp vụ để chuyên gia chấm đúng chuẩn Nón Sơn
    const cau = await rpc('fn_ht_ai_nguyen_lieu', { p_ht: 0 }).catch(() => null);
    let quyTac = cau?.ai_loi_dan || '';
    if (!quyTac) {
      const r = await fetch(`${SB_URL}/rest/v1/ht_cau_hinh?id=eq.1&select=ai_loi_dan`, {
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Accept-Profile': 'care' }
      });
      const a = await r.json().catch(() => []);
      quyTac = Array.isArray(a) && a[0] ? (a[0].ai_loi_dan || '') : '';
    }

    const ds = await rpc('fn_hoc_ung_vien', { p_gh: mo.so_ht || 6 });
    soUngVien = Array.isArray(ds) ? ds.length : 0;

    // Chấm SONG SONG theo nhóm để nhanh; ngân sách 10s (Vercel cắt ~25s)
    const dsArr = Array.isArray(ds) ? ds : [];
    const SONG_SONG = 4;
    for (let i = 0; i < dsArr.length; i += SONG_SONG) {
      if (Date.now() - t0 > 10000) { hetGio = true; break; }
      await Promise.all(dsArr.slice(i, i + SONG_SONG).map(ht => chamMotCaAnToan(ht, quyTac, mo)));
    }
  } catch (e) {
    loi = (loi ? loi + ' | ' : '') + (e?.message || 'loi_khong_ro');
    console.error('hoc-runner:', e?.message);
  }

  // ---- hàm chấm 1 ca có bắt lỗi, dùng trong Promise.all ----
  async function chamMotCaAnToan(ht, quyTac, mo) {
      try {
        const kq = await chamMotCa(ht, quyTac, mo.model);
        soCham++;
        if (kq.dang_hoc === false) return;             // ca vô nghĩa -> bỏ, không lưu
        const CHU_DE_OK = ['hoi_gia','chot_don','che_dat','gui_anh','doi_tra','khieu_nai','hoi_size','khach_im','khac'];
        const chuDe = CHU_DE_OK.includes(String(kq.chu_de || '')) ? kq.chu_de : 'khac';
        const loaiBH = (kq.loai_bai_hoc === 'nen' || kq.loai_bai_hoc === 'tranh')
          ? kq.loai_bai_hoc : (kq.ket_qua === 'that_bai' ? 'tranh' : 'nen');
        const baiHoc = String(kq.bai_hoc || '').trim().slice(0, 400);
        if (!baiHoc) return;                          // không rút được bài học thì bỏ
        await rpc('fn_hoc_ghi', { p_data: {
          hoi_thoai_id: ht.ht_id, kenh: ht.kenh, den_luc: ht.den_luc, so_tin: ht.so_tin,
          ket_qua: kq.ket_qua, ly_do_ket_qua: kq.ly_do_ket_qua,
          diem: kq.diem, tom_tat: kq.tom_tat, chu_de: chuDe,
          nuoc_di_hay: kq.nuoc_di_hay, loi_sai: kq.loi_sai,
          cau_tra_loi_mau: kq.cau_tra_loi_mau, bai_hoc: baiHoc,
          loai_bai_hoc: loaiBH,
          dan_chung: Array.isArray(kq.dan_chung) ? kq.dan_chung : [],
          model: mo.model
        } });
        soBai++;
      } catch (e) {
        console.error('cham ca', ht.ht_id, e?.message);
        loi = (loi ? loi + ' | ' : '') + `HT${ht.ht_id}: ${e?.message}`.slice(0, 160);
      }
  }

  let conLai = 0;
  try {
    if (lo) await rpc('fn_hoc_lo_dong', { p_lo: lo, p_so_cham: soCham, p_so_bai: soBai, p_loi: loi });
    conLai = await rpc('fn_hoc_con_lai', {});
  } catch (_) {}

  return json({ ok: !loi, so_cham: soCham, so_bai_moi: soBai, ung_vien: soUngVien,
    con_lai: conLai, het_gio: hetGio, vung: process.env.VERCEL_REGION || '?', loi });
}
