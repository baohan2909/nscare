import { supabase } from './supabase'
import { layToken, xoaPhien } from './session'
import { ZALO_GW_URL } from './config'

// Gọi hàm fn_* trên Supabase. Tự chèn p_token (trừ khi bỏ qua).
async function rpc(fn, args = {}, { token = true } = {}) {
  const params = { ...args }
  if (token) params.p_token = layToken()
  const { data, error } = await supabase.rpc(fn, params)
  if (error) {
    // Phiên hỏng -> đăng xuất để quay lại màn đăng nhập
    const msg = (error.message || '') + (error.details || '')
    if (/PHIEN_KHONG_HOP_LE|KHONG_DU_QUYEN/.test(msg)) {
      if (/PHIEN_KHONG_HOP_LE/.test(msg)) { xoaPhien(); location.reload() }
    }
    throw new Error(viLoi(error.message) || 'Có lỗi xảy ra')
  }
  return data
}

// Dịch mã lỗi ra tiếng Việt
function viLoi(m = '') {
  const map = {
    SAI_TAI_KHOAN_MAT_KHAU: 'Sai mã nhân viên hoặc mật khẩu',
    SDT_KHONG_HOP_LE: 'Số điện thoại không hợp lệ',
    SDT_TRONG_DANH_SACH_KHONG_GOI: 'Số này nằm trong danh sách không gọi',
    KHONG_DU_QUYEN: 'Bạn không đủ quyền thực hiện',
    KHONG_THAY_PHIEU: 'Không tìm thấy phiếu',
    KHONG_THAY_KHACH: 'Không tìm thấy khách',
    BO_DA_PHAT_HANH_KHONG_SUA_DUOC: 'Bộ câu hỏi đã phát hành, không sửa được'
  }
  for (const k in map) if (m.includes(k)) return map[k]
  return m
}

export const api = {
  // --- Auth ---
  async dangNhap(ma_nv, mat_khau) {
    const rows = await rpc('fn_dangnhap', { p_ma_nv: ma_nv, p_mat_khau: mat_khau }, { token: false })
    return Array.isArray(rows) ? rows[0] : rows
  },
  dangXuat: () => rpc('fn_dangxuat', {}),

  // --- Danh mục ---
  spTim: (tu_khoa) => rpc('fn_sp_tim', { p_tu_khoa: tu_khoa }),

  // --- Nhập đơn / phiếu ---
  nhapDon: (p) => rpc('fn_nhap_don', {
    p_sdt: p.sdt, p_ten: p.ten, p_kenh_ma: p.kenh_ma,
    p_ngay_nhan: p.ngay_nhan, p_sanpham: p.sanpham, p_gop: p.gop ?? true
  }),
  hangDoi: (trang_thai = null, tu_khoa = null) =>
    rpc('fn_hangdoi', { p_trang_thai: trang_thai, p_tu_khoa: tu_khoa }),
  phieu: (id) => rpc('fn_phieu', { p_phieu_id: id }),
  khach360: (sdt) => rpc('fn_khach_360', { p_sdt: sdt }),

  ghiLienHe: (p) => rpc('fn_ghi_lienhe', {
    p_phieu_id: p.phieu_id, p_ket_qua: p.ket_qua,
    p_kenh: p.kenh || 'goi', p_hen_luc: p.hen_luc || null, p_ghi_chu: p.ghi_chu || null
  }),
  luuTraLoi: (p) => rpc('fn_luu_traloi', {
    p_phieu_id: p.phieu_id, p_tra_loi: p.tra_loi || [],
    p_y_kien: p.y_kien || [], p_diem_neo: p.diem_neo ?? null,
    p_dong_y: p.dong_y ?? null, p_hoan_tat: p.hoan_tat ?? true
  }),

  // --- Tổng quan / phân tích ---
  tongQuan: () => rpc('fn_tong_quan', {}),
  tinHieuDo: () => rpc('fn_tin_hieu_do', {}),
  khungGio: () => rpc('fn_khung_gio', {}),
  phanTich: (p = {}) => rpc('fn_phan_tich', {
    p_tu: p.tu || null, p_den: p.den || null, p_dong: p.dong || null,
    p_nhom: p.nhom || null, p_sac_thai: p.sac_thai || null
  }),

  // --- Bộ câu hỏi ---
  bocauhoiDs: () => rpc('fn_bocauhoi_ds', {}),
  bocauhoiChitiet: (id) => rpc('fn_bocauhoi_chitiet', { p_id: id }),
  bocauhoiTao: (ten, ap_dung, loi_mo) =>
    rpc('fn_bocauhoi_tao', { p_ten: ten, p_ap_dung: ap_dung || 'tat_ca', p_loi_mo: loi_mo || null }),
  cauhoiLuu: (bo_id, cau_hoi) => rpc('fn_cauhoi_luu', { p_bo_id: bo_id, p_cau_hoi: cau_hoi }),
  bocauhoiPhatHanh: (id) => rpc('fn_bocauhoi_phathanh', { p_id: id }),
  bocauhoiBanMoi: (id) => rpc('fn_bocauhoi_ban_moi', { p_id: id }),

  // --- Quản trị ---
  configLay: () => rpc('fn_config_lay', {}),
  configDat: (khoa, gt) => rpc('fn_config_dat', { p_khoa: khoa, p_gia_tri: gt }),
  khongGoiDs: () => rpc('fn_khong_goi_ds', {}),
  anDanhKhach: (sdt) => rpc('fn_an_danh_khach', { p_sdt: sdt }),
  nhatKy: (gh = 100) => rpc('fn_nhat_ky', { p_gioi_han: gh }),

  // --- v1.5: bổ sung SĐT + cuộc gọi/ghi âm + click-to-call ---
  boSungSdt: (phieu_id, sdt, ten) =>
    rpc('fn_bo_sung_sdt', { p_phieu_id: phieu_id, p_sdt: sdt, p_ten: ten || null }),
  cuocGoiKh: (phieu_id) => rpc('fn_cuoc_goi_kh', { p_phieu_id: phieu_id }),
  xuatCrm: (tu, den) => rpc('fn_xuat_crm', { p_tu: tu || null, p_den: den || null }),

  // --- MARKETING 360 ---
  mktTongQuan: () => rpc('fn_mkt_tong_quan', {}),
  mktKhachDs: (tim, follow, tinh, trang = 0, so = 50) =>
    rpc('fn_mkt_khach_ds', { p_tim: tim || null, p_follow: follow || null,
      p_tinh: tinh || null, p_trang: trang, p_so: so }),
  mktDemPhanKhuc: (follow, tinh, nhan) =>
    rpc('fn_mkt_dem_phan_khuc', { p_follow: follow || 'tat_ca', p_tinh: tinh || null, p_nhan: nhan || null }),
  mktMauDs: () => rpc('fn_mkt_mau_ds', {}),
  mktMauLuu: (p) => rpc('fn_mkt_mau_luu', { p }),
  mktCdDs: () => rpc('fn_mkt_cd_ds', {}),
  mktCdTao: (p) => rpc('fn_mkt_cd_tao', { p }),
  mktCdTrangThai: (id, tt) => rpc('fn_mkt_cd_trang_thai', { p_id: id, p_tt: tt }),
  mktCdChiTiet: (id) => rpc('fn_mkt_cd_chi_tiet', { p_id: id }),
  mktPhanHoi: (gh = 100) => rpc('fn_mkt_phan_hoi', { p_gh: gh }),
  mktPhanHoiXong: (id) => rpc('fn_mkt_phan_hoi_xong', { p_id: id }),
  mktGuiThu: (mau_id, sdt) => rpc('fn_mkt_gui_thu', { p_mau_id: mau_id, p_sdt: sdt }),
  mktGuiThuDs: (mau_id) => rpc('fn_mkt_gui_thu_ds', { p_mau_id: mau_id, p_gh: 8 }),
  mktLienKetZalo: (su_kien_id, sdt) => rpc('fn_mkt_lien_ket_zalo', { p_su_kien_id: su_kien_id, p_sdt: sdt }),
  // Gửi tức thì qua cổng Zalo (Vercel) — không qua hàng đợi cron
  guiNgay: async (payload) => {
    if (!ZALO_GW_URL) throw new Error('Chưa cấu hình ZALO_GW_URL')
    const r = await fetch(ZALO_GW_URL + '/gui-ngay', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: layToken(), ...payload })
    })
    return r.json()
  },
  aiGoiY: async (payload) => {
    const r = await fetch(ZALO_GW_URL + '/ai-goi-y', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: layToken(), goi_y_so: 3, ...payload })
    })
    return r.json()
  },
  // ===== HỘP CHAT =====
  htDs: (loc, tim) => rpc('fn_ht_ds', { p_loc: loc, p_tim: tim || null }),
  htTin: (ht) => rpc('fn_ht_tin', { p_ht: ht }),
  htGan: (ht, ma_nv) => rpc('fn_ht_gan', { p_ht: ht, p_ma_nv: ma_nv || null }),
  htTrangThai: (ht, tt) => rpc('fn_ht_trang_thai', { p_ht: ht, p_tt: tt }),
  htMauCau: () => rpc('fn_ht_mau_cau', {}),
  htCauHinh: () => rpc('fn_ht_cau_hinh', {}),
  htCauHinhLuu: (p) => rpc('fn_ht_cau_hinh_luu', { p }),
  htAiTat: (ht, tat) => rpc('fn_ht_ai_tat', { p_ht: ht, p_tat: tat }),
  htSuaKhach: (ht, ten, sdt) => rpc('fn_ht_sua_khach', { p_ht: ht, p_ten: ten, p_sdt: sdt }),
  htTongChuaDoc: () => rpc('fn_ht_tong_chua_doc', {}),
  async goiTongDai(sdt) {
    const { WEBHOOK_APP_URL, CALL_TOKEN } = await import('./config')
    if (!WEBHOOK_APP_URL) throw new Error('Chưa cấu hình tổng đài (WEBHOOK_APP_URL)')
    const u = WEBHOOK_APP_URL + '?src=click2call&token=' + encodeURIComponent(CALL_TOKEN) +
              '&sdt=' + encodeURIComponent(sdt)
    const res = await fetch(u, { method: 'GET' })
    const j = await res.json().catch(() => ({}))
    if (!j.ok) throw new Error(j.loi || 'Tổng đài không nhận lệnh gọi')
    return j
  }
}
