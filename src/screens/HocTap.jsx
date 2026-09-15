import { useEffect, useState, useCallback, useRef } from 'react'
import { api } from '../lib/api'
import { ZALO_GW_URL } from '../lib/config'
import { layToken } from '../lib/session'
import { Toast } from '../components/ui'
import { IcSpark, IcCheck, IcGear, IcChevD, IcRefresh } from '../components/Icons'

const CHU_DE = {
  hoi_gia: 'Hỏi giá', chot_don: 'Chốt đơn', che_dat: 'Chê đắt', gui_anh: 'Gửi ảnh',
  doi_tra: 'Đổi trả', khieu_nai: 'Khiếu nại', hoi_size: 'Hỏi size', khach_im: 'Khách im', khac: 'Khác'
}

export default function HocTap() {
  const [tai, setTai] = useState(true)
  const [cf, setCf] = useState(null)
  const [tq, setTq] = useState(null)
  const [ds, setDs] = useState([])
  const [loc, setLoc] = useState({ trang_thai: 'cho_duyet', loai: null, chu_de: null })
  const [chon, setChon] = useState([])
  const [moDc, setMoDc] = useState(null)      // id đang mở dẫn chứng
  const [tinDc, setTinDc] = useState({})      // cache tin hội thoại
  const [chay, setChay] = useState(null)      // tiến trình học ngay
  const [loiCuoi, setLoiCuoi] = useState(null) // lỗi lượt chạy gần nhất
  const dungRef = useRef(false)
  const [modal, setModal] = useState(null)    // 'cauhinh' | {sua: bài}
  const [apDung, setApDung] = useState(null)  // tab đang áp dụng
  const [camNang, setCamNang] = useState(null)   // cẩm nang đã chưng cất
  const [dangCC, setDangCC] = useState(null)     // tiến trình chưng cất
  const [kemSp, setKemSp] = useState(true)
  const [kemMc, setKemMc] = useState(true)
  const [banXuat, setBanXuat] = useState(null)   // bản tổng hợp đang xem
  const [tab, setTab] = useState('duyet')
  const [toast, setToast] = useState(null)

  const nap = useCallback(async () => {
    try {
      const [c, t, d] = await Promise.all([
        api.hocCauHinh(), api.hocTongQuan(),
        api.hocDs(loc.trang_thai, loc.loai, loc.chu_de)
      ])
      setCf(c || {}); setTq(t || {}); setDs(Array.isArray(d) ? d : [])
    } catch (e) { setToast({ msg: e.message, kind: 'err' }) }
    setTai(false)
  }, [loc])

  useEffect(() => { nap() }, [nap])
  useEffect(() => { if (tab === 'apdung') api.hocDangApDung().then(setApDung).catch(() => {}) }, [tab])

  async function luuCf(patch) {
    const moi = { ...cf, ...patch }
    setCf(moi)
    try { await api.hocCauHinhLuu(patch); setToast({ msg: 'Đã lưu' }) }
    catch (e) { setToast({ msg: e.message, kind: 'err' }); nap() }
  }

  async function hocNgay() {
    if (!cf?.bat) { setToast({ msg: 'Bật học tập trước đã anh nhé', kind: 'err' }); return }
    setChay({ dang: true, cham: 0, bai: 0 }); setLoiCuoi(null)
    dungRef.current = false
    let tongCham = 0, tongBai = 0, loiGom = null, ungVien = 0, vung = ''
    try {
      for (let i = 0; i < 400; i++) {
        if (dungRef.current) { setToast({ msg: `Đã dừng: chấm ${tongCham} hội thoại, ${tongBai} bài học` }); break }
        const r = await fetch(ZALO_GW_URL + '/hoc-runner?nguon=tay', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: layToken() || '' })
        })
        const j = await r.json().catch(() => ({}))
        if (j.loi === 'KHONG_CO_QUYEN') { setToast({ msg: 'Phiên hết hạn hoặc không đủ quyền — đăng nhập lại giúp em', kind: 'err' }); break }
        if (j.chay === false) {
          if (j.ly_do === 'TAT') { setLoiCuoi('Học tập đang TẮT — gạt công tắc "Bật học tập" ở trên.'); break }
          // DANG_CHAY: lượt tự động đang chạy hoặc khóa còn kẹt -> chờ rồi thử lại
          if (i < 3) { await new Promise(r => setTimeout(r, 3000)); continue }
          setLoiCuoi('Một lượt khác đang chạy. Nếu kẹt lâu, bấm "Mở khóa" rồi thử lại.')
          break
        }
        tongCham += j.so_cham || 0; tongBai += j.so_bai_moi || 0
        ungVien = j.ung_vien ?? ungVien; if (j.vung) vung = j.vung
        setChay({ dang: true, cham: tongCham, bai: tongBai, con: j.con_lai })
        if (j.loi) loiGom = String(j.loi)
        if (!j.con_lai) break
        if ((j.so_cham || 0) === 0 && !j.het_gio) break   // không tiến triển -> dừng, tránh lặp vô ích
      }
      if (loiGom) {
        setLoiCuoi(loiGom + (vung ? ` · vùng chạy: ${vung}` : ''))
        setToast({ msg: 'Chạy xong nhưng có lỗi — xem chi tiết bên dưới nút Học ngay', kind: 'err' })
      } else if (tongCham === 0) {
        setLoiCuoi(ungVien === 0
          ? 'Lượt này không lấy được hội thoại nào. Nếu còn ca chờ chấm, thử bấm "Mở khóa" rồi chạy lại.'
          : `Lấy được ${ungVien} hội thoại nhưng chưa chấm được ca nào.`)
        setToast({ msg: 'Chưa chấm được ca nào — xem chi tiết bên dưới', kind: 'err' })
      } else {
        setToast({ msg: `Xong: chấm ${tongCham} hội thoại, ${tongBai} bài học mới` })
      }
    } catch (e) {
      setToast({ msg: /Failed to fetch|NetworkError/i.test(e.message)
        ? 'Không gọi được máy chủ học tập — kiểm tra đã up zalooa bản mới và Redeploy chưa' : e.message, kind: 'err' })
    }
    setChay(null); nap()
  }

  async function moCamNang() {
    setTab('xuat')
    try { setCamNang(await api.hocCamNang()) } catch (e) { setToast({ msg: e.message, kind: 'err' }) }
  }

  async function chungCat(lamLai) {
    setDangCC({ nhom: 0 })
    try {
      if (lamLai) await api.hocCnLamLai()
      let tongNhom = 0
      for (let i = 0; i < 40; i++) {
        const r = await fetch(ZALO_GW_URL + '/hoc-chungcat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: layToken() || '' })
        })
        const j = await r.json().catch(() => ({}))
        if (j.loi) { setToast({ msg: 'Lỗi: ' + String(j.loi).slice(0, 140), kind: 'err' }); break }
        tongNhom += j.so_nhom || 0
        setDangCC({ nhom: tongNhom, con: j.con_nhom })
        if (j.xong || !j.con_nhom) break
      }
      setCamNang(await api.hocCamNang())
      setToast({ msg: 'Đã chưng cất xong cẩm nang' })
    } catch (e) {
      setToast({ msg: /Failed to fetch/i.test(e.message) ? 'Không gọi được máy chủ — kiểm tra đã up zalooa mới chưa' : e.message, kind: 'err' })
    }
    setDangCC(null)
  }

  async function xuatTongHop() {
    setDangCC({ nhom: 0, tong: true })
    try {
      const r = await api.hocXuatTongHop(kemSp, kemMc)
      setBanXuat(r)
      setToast({ msg: `Đã tạo bản tổng hợp (${Math.round((r.do_dai || 0) / 1000)} nghìn ký tự)` })
    } catch (e) { setToast({ msg: e.message, kind: 'err' }) }
    setDangCC(null)
  }

  function noiDungXuat() { return banXuat?.noi_dung || camNang?.noi_dung || '' }

  function saoChep() {
    const t = noiDungXuat()
    if (!t) return
    navigator.clipboard.writeText(t)
      .then(() => setToast({ msg: 'Đã sao chép - dán thẳng vào Nhanh.vn được rồi anh' }))
      .catch(() => setToast({ msg: 'Trình duyệt chặn sao chép, anh bôi đen rồi Ctrl+C', kind: 'err' }))
  }

  function taiFile() {
    const t = noiDungXuat()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([t], { type: 'text/plain;charset=utf-8' }))
    a.download = 'Cam_nang_tu_van_Non_Son.txt'
    a.click()
  }

  async function moKhoa() {
    try { await api.hocMoKhoa(); setLoiCuoi('Đã mở khóa, bấm Học ngay lại.'); nap() }
    catch (e) { setToast({ msg: e.message, kind: 'err' }) }
  }

  async function kiemTraAI() {
    setLoiCuoi('Đang kiểm tra kết nối AI…')
    try {
      const r = await fetch(ZALO_GW_URL + '/hoc-runner?kiemtra=1', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: layToken() || '' })
      })
      const j = await r.json().catch(() => ({}))
      if (j.ok) setLoiCuoi(`AI OK · vùng chạy: ${j.vung} · AI trả lời: "${j.tra_loi}"`)
      else setLoiCuoi(`AI LỖI ${j.http || ''} · vùng chạy: ${j.vung || '?'} · ${j.loi || j.ly_do || 'không rõ'}`)
    } catch (e) {
      setLoiCuoi('Không gọi được máy chủ: ' + e.message)
    }
  }

  async function duyetLo(hanh_dong, ids = chon, bai_hoc_sua = null) {
    if (!ids.length) return
    try {
      await api.hocDuyet(ids, hanh_dong, bai_hoc_sua)
      setToast({ msg: hanh_dong === 'duyet' ? `Đã duyệt ${ids.length} bài` : hanh_dong === 'bo' ? `Đã bỏ ${ids.length} bài` : 'Đã lưu' })
      setChon([]); setModal(null); nap()
    } catch (e) { setToast({ msg: e.message, kind: 'err' }) }
  }

  async function xemDanChung(b) {
    if (moDc === b.id) { setMoDc(null); return }
    setMoDc(b.id)
    if (!tinDc[b.hoi_thoai_id]) {
      try {
        const t = await api.htTin(b.hoi_thoai_id, 60)
        setTinDc(s => ({ ...s, [b.hoi_thoai_id]: Array.isArray(t) ? t : [] }))
      } catch (_) { setTinDc(s => ({ ...s, [b.hoi_thoai_id]: [] })) }
    }
  }

  const toggle = (id) => setChon(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])

  if (tai) return <div className="hoc-tai">Đang tải…</div>

  return (
    <div className="hoc-wrap">
      {/* ---- Thanh điều khiển ---- */}
      <div className="hoc-head">
        <div className="hoc-head-l">
          <div className="hoc-ic"><IcSpark size={22} /></div>
          <div>
            <h2>AI Học tập</h2>
            <p>Học từ ca thành công, mổ xẻ ca thất bại — bài học chỉ áp dụng sau khi anh duyệt</p>
          </div>
        </div>
        <div className="hoc-head-r">
          <div className="hoc-sw-box">
            <span>Bật học tập</span>
            <button className={'sw' + (cf?.bat ? ' on' : '')} onClick={() => luuCf({ bat: !cf.bat })} />
          </div>
          <div className="hoc-sw-box">
            <span>Tự động mỗi đêm</span>
            <button className={'sw' + (cf?.tu_dong ? ' on' : '')} onClick={() => luuCf({ tu_dong: !cf.tu_dong })} />
          </div>
          <div className="hoc-sw-box">
            <span>Tự duyệt</span>
            <button className={'sw' + (cf?.tu_duyet ? ' on' : '')} onClick={() => luuCf({ tu_duyet: !cf.tu_duyet })} />
          </div>
          <button className="btn-hd" onClick={() => setModal('cauhinh')}><IcGear size={16} /> Cấu hình</button>
        </div>
      </div>

      {/* ---- Thẻ số ---- */}
      <div className="hoc-stats">
        <div className="hoc-stat cho"><b>{tq?.cho_duyet ?? 0}</b><span>Chờ duyệt</span></div>
        <div className="hoc-stat ok"><b>{tq?.da_duyet ?? 0}</b><span>Đã duyệt</span></div>
        <div className="hoc-stat tc"><b>{tq?.thanh_cong ?? 0}</b><span>Ca thành công</span></div>
        <div className="hoc-stat tb"><b>{tq?.that_bai ?? 0}</b><span>Ca thất bại</span></div>
        <div className="hoc-run">
          {chay?.dang
            ? <div className="hoc-prog">
                <span><IcRefresh size={16} className="quay" /> Đã chấm {chay.cham} · {chay.bai} bài{chay.con != null ? ` · còn ${chay.con}` : ''}</span>
                <button className="btn-ghost" onClick={() => { dungRef.current = true }}>Dừng</button>
              </div>
            : <div className="hoc-nut">
                <button className="btn-ai" onClick={hocNgay}><IcSpark size={16} /> Học ngay</button>
                <button className="btn-ghost" onClick={kiemTraAI}>Kiểm tra AI</button>
                <button className="btn-ghost" onClick={moKhoa}>Mở khóa</button>
              </div>}
          <div className="hoc-lo">
            {loiCuoi && <span className="hoc-loi">{loiCuoi}</span>}
            {tq?.con_cho_cham > 0 && <span>{tq.con_cho_cham} hội thoại chờ chấm</span>}
            {tq?.lo_cuoi && <span>Lượt gần nhất: {tq.lo_cuoi.so_cham} ca · {tq.lo_cuoi.so_bai_moi} bài</span>}
          </div>
        </div>
      </div>

      {/* ---- Tab ---- */}
      <div className="hoc-tabs">
        <button className={tab === 'duyet' ? 'on' : ''} onClick={() => setTab('duyet')}>Bài học</button>
        <button className={tab === 'apdung' ? 'on' : ''} onClick={() => setTab('apdung')}>
          Đang áp dụng ({(tq?.nen_dang_ap || 0) + (tq?.tranh_dang_ap || 0)})
        </button>
        <button className={tab === 'xuat' ? 'on' : ''} onClick={moCamNang}>Xuất trí tuệ</button>
      </div>

      {tab === 'xuat' ? (
        <div className="hoc-xuat">
          <div className="hoc-xuat-top">
            <div>
              <h3>Cẩm nang đúc kết</h3>
              <p><b>Bản TỔNG HỢP</b> gồm đủ: nguyên tắc tư vấn, phong cách, tri thức nghiệp vụ, kiến thức sản phẩm, mẫu câu và bài học đúc kết - dán thẳng vào chatbot Nhanh.vn.</p>
              <div className="hoc-tuychon">
                <label><input type="checkbox" checked={kemSp} onChange={e => setKemSp(e.target.checked)} /> Kèm danh mục sản phẩm</label>
                <label><input type="checkbox" checked={kemMc} onChange={e => setKemMc(e.target.checked)} /> Kèm mẫu câu trả lời</label>
              </div>
              <p className="hoc-xuat-so">
                {camNang?.bai_duyet || 0} bài đã duyệt · {camNang?.nhom_xong || 0} nhóm đã đúc kết
                {camNang?.nhom_con > 0 ? ` · còn ${camNang.nhom_con} nhóm chưa làm` : ''}
                {camNang?.tao_luc ? ` · cập nhật ${new Date(camNang.tao_luc).toLocaleString('vi-VN')}` : ''}
              </p>
            </div>
            <div className="hoc-nut">
              {dangCC
                ? <span className="hoc-prog"><span><IcRefresh size={16} className="quay" /> {dangCC.tong ? 'Đang gom toàn bộ tri thức…' : `Đang đúc kết ${dangCC.nhom} nhóm${dangCC.con ? ` · còn ${dangCC.con}` : ''}…`}</span></span>
                : <>
                    <button className="btn-ai" onClick={xuatTongHop}><IcSpark size={16} /> Xuất bản TỔNG HỢP</button>
                    <button className="btn-ghost" onClick={() => chungCat(false)}>Đúc kết bài học</button>
                    <button className="btn-ghost" onClick={() => chungCat(true)}>Đúc lại từ đầu</button>
                  </>}
            </div>
          </div>

          {banXuat?.noi_dung && (
            <div className="hoc-xuat-tt">
              Bản tổng hợp: {Math.round((banXuat.do_dai || 0) / 1000)} nghìn ký tự
              {banXuat.so_sp ? ` · ${banXuat.so_sp} sản phẩm` : ''}
              {banXuat.so_bai_hoc ? ` · ${banXuat.so_bai_hoc} bài học` : ''}
              {banXuat.co_quy_tac ? ' · có quy tắc' : ''}
              {banXuat.co_tri_thuc ? ' · có tri thức nghiệp vụ' : ''}
            </div>
          )}
          {noiDungXuat() ? (
            <>
              <div className="hoc-xuat-act">
                <button className="btn-ai" onClick={saoChep}>Sao chép toàn bộ</button>
                <button className="btn-ghost" onClick={taiFile}>Tải file .txt</button>
              </div>
              <pre className="hoc-camnang">{noiDungXuat()}</pre>
            </>
          ) : (
            <p className="hoc-trong">Chưa có cẩm nang. Bấm "Đúc kết cẩm nang" để AI gộp toàn bộ bài học đã duyệt.</p>
          )}
        </div>
      ) : tab === 'apdung' ? (
        <div className="hoc-ap">
          <div className="hoc-ap-col">
            <h3 className="nen">NÊN LÀM ({apDung?.nen?.length || 0})</h3>
            {(apDung?.nen || []).map(x => <div key={x.id} className="hoc-ap-item nen">{x.bai_hoc}</div>)}
            {!apDung?.nen?.length && <p className="hoc-trong">Chưa có bài học nào được duyệt.</p>}
          </div>
          <div className="hoc-ap-col">
            <h3 className="tranh">TRÁNH ({apDung?.tranh?.length || 0})</h3>
            {(apDung?.tranh || []).map(x => <div key={x.id} className="hoc-ap-item tranh">{x.bai_hoc}</div>)}
            {!apDung?.tranh?.length && <p className="hoc-trong">Chưa có bài học nào được duyệt.</p>}
          </div>
        </div>
      ) : (
        <>
          {/* ---- Lọc ---- */}
          <div className="hoc-loc">
            {[['cho_duyet', 'Chờ duyệt'], ['da_duyet', 'Đã duyệt'], ['bo', 'Đã bỏ'], ['tat_ca', 'Tất cả']].map(([v, n]) => (
              <button key={v} className={'hoc-chip' + (loc.trang_thai === v ? ' on' : '')}
                onClick={() => { setLoc(s => ({ ...s, trang_thai: v })); setChon([]) }}>{n}</button>
            ))}
            <span className="hoc-sep" />
            {[['nen', 'NÊN'], ['tranh', 'TRÁNH']].map(([v, n]) => (
              <button key={v} className={'hoc-chip' + (loc.loai === v ? ' on' : '')}
                onClick={() => setLoc(s => ({ ...s, loai: s.loai === v ? null : v }))}>{n}</button>
            ))}
            <select className="hoc-sel" value={loc.chu_de || ''} onChange={e => setLoc(s => ({ ...s, chu_de: e.target.value || null }))}>
              <option value="">Mọi chủ đề</option>
              {Object.entries(CHU_DE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          {/* ---- Danh sách bài học ---- */}
          {!ds.length && <p className="hoc-trong">Chưa có bài học nào ở mục này. Bấm "Học ngay" để chuyên gia AI chấm các hội thoại đã kết thúc.</p>}

          {ds.map(b => (
            <div key={b.id} className={'hoc-card ' + (b.loai_bai_hoc || 'nen')}>
              <div className="hoc-card-top">
                <label className="hoc-ck">
                  <input type="checkbox" checked={chon.includes(b.id)} onChange={() => toggle(b.id)} />
                </label>
                <span className={'hoc-badge ' + (b.ket_qua || '')}>
                  {b.ket_qua === 'thanh_cong' ? 'Thành công' : b.ket_qua === 'that_bai' ? 'Thất bại' : 'Chưa rõ'}
                </span>
                {b.diem != null && <span className="hoc-diem">{b.diem}/10</span>}
                {b.chu_de && <span className="hoc-cd">{CHU_DE[b.chu_de] || b.chu_de}</span>}
                <span className={'kenh-chip ' + (b.kenh === 'facebook' ? 'fb' : 'za')}>{b.kenh === 'facebook' ? 'Facebook' : 'Zalo'}</span>
                {b.trang_thai === 'da_duyet' && <span className="hoc-dd"><IcCheck size={13} /> {b.ai_tu_duyet ? 'AI tự duyệt' : 'Đã duyệt'}</span>}
                {b.trang_thai === 'bo' && <span className="hoc-bo">Đã bỏ</span>}
                {b.da_sua && <span className="hoc-sua-tag">đã sửa</span>}
              </div>

              <div className="hoc-bh">{b.bai_hoc}</div>
              {b.tom_tat && <div className="hoc-tt">{b.tom_tat}</div>}
              {b.loi_sai && <div className="hoc-ls"><b>Sai ở đâu:</b> {b.loi_sai}</div>}
              {b.nuoc_di_hay && <div className="hoc-nd"><b>Làm tốt:</b> {b.nuoc_di_hay}</div>}
              {b.cau_tra_loi_mau && <div className="hoc-mau"><b>Câu trả lời mẫu</b><p>{b.cau_tra_loi_mau}</p></div>}

              <div className="hoc-card-act">
                <button className="hoc-link" onClick={() => xemDanChung(b)}>
                  <IcChevD size={14} style={{ transform: moDc === b.id ? 'rotate(180deg)' : 'none' }} /> Xem dẫn chứng
                </button>
                {b.trang_thai !== 'da_duyet' && <button className="btn-mini" onClick={() => duyetLo('duyet', [b.id])}>Duyệt</button>}
                <button className="btn-mini" onClick={() => setModal({ sua: b })}>Sửa</button>
                {b.trang_thai !== 'bo' && <button className="btn-mini warn" onClick={() => duyetLo('bo', [b.id])}>Bỏ</button>}
              </div>

              {moDc === b.id && (
                <div className="hoc-dc">
                  {(tinDc[b.hoi_thoai_id] || []).map((t, i) => {
                    const noiBat = (b.dan_chung || []).includes(i + 1)
                    return (
                      <div key={i} className={'hoc-tin ' + (t.chieu === 'den' ? 'khach' : 'ns') + (noiBat ? ' noibat' : '')}>
                        <span className="hoc-tin-ai">{t.chieu === 'den' ? 'Khách' : (t.nguoi_gui === 'AI' ? 'NS AI' : 'Nón Sơn')}</span>
                        {t.loai === 'image' ? '[hình ảnh]' : t.noi_dung}
                      </div>
                    )
                  })}
                  {!(tinDc[b.hoi_thoai_id] || []).length && <p className="hoc-trong">Không tải được hội thoại gốc.</p>}
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {/* ---- Thanh hành động lô ---- */}
      {chon.length > 0 && (
        <div className="hoc-lo-bar">
          <span>{chon.length} bài đã chọn</span>
          <button className="btn-ai" onClick={() => duyetLo('duyet')}><IcCheck size={15} /> Duyệt {chon.length}</button>
          <button className="btn-ghost" onClick={() => duyetLo('bo')}>Bỏ {chon.length}</button>
          <button className="btn-ghost" onClick={() => setChon([])}>Huỷ chọn</button>
        </div>
      )}

      {/* ---- Modal cấu hình ---- */}
      {modal === 'cauhinh' && (
        <div className="hoc-lop" onClick={() => setModal(null)}>
          <div className="hoc-modal" onClick={e => e.stopPropagation()}>
            <h3>Cấu hình học tập</h3>
            <label>Bộ máy chuyên gia</label>
            <select value={cf.model || 'claude-sonnet-5'} onChange={e => luuCf({ model: e.target.value })}>
              <option value="claude-sonnet-5">Claude Sonnet 5 — chấm sâu, khuyên dùng</option>
              <option value="claude-haiku-4-5">Claude Haiku 4.5 — rẻ hơn, chấm nông hơn</option>
            </select>
            <label>Số hội thoại mỗi lượt: {cf.so_ht_moi_luot}</label>
            <input type="range" min="2" max="40" value={cf.so_ht_moi_luot || 20}
              onChange={e => setCf(s => ({ ...s, so_ht_moi_luot: +e.target.value }))}
              onMouseUp={e => luuCf({ so_ht_moi_luot: +e.target.value })}
              onTouchEnd={e => luuCf({ so_ht_moi_luot: +e.target.value })} />
            <label>Hội thoại ít nhất bao nhiêu tin mới chấm: {cf.it_nhat_tin}</label>
            <input type="range" min="2" max="12" value={cf.it_nhat_tin || 4}
              onChange={e => setCf(s => ({ ...s, it_nhat_tin: +e.target.value }))}
              onMouseUp={e => luuCf({ it_nhat_tin: +e.target.value })}
              onTouchEnd={e => luuCf({ it_nhat_tin: +e.target.value })} />
            <label>Khách im bao lâu thì coi hội thoại đã kết thúc: {cf.gio_im_ket_thuc} giờ</label>
            <input type="range" min="2" max="72" step="2" value={cf.gio_im_ket_thuc || 24}
              onChange={e => setCf(s => ({ ...s, gio_im_ket_thuc: +e.target.value }))}
              onMouseUp={e => luuCf({ gio_im_ket_thuc: +e.target.value })}
              onTouchEnd={e => luuCf({ gio_im_ket_thuc: +e.target.value })} />
            <button className="btn-ai full" onClick={() => setModal(null)}>Xong</button>
          </div>
        </div>
      )}

      {/* ---- Modal sửa bài học ---- */}
      {modal?.sua && (
        <div className="hoc-lop" onClick={() => setModal(null)}>
          <div className="hoc-modal" onClick={e => e.stopPropagation()}>
            <h3>Sửa bài học</h3>
            <p className="hoc-goc">Bản gốc: {modal.sua.bai_hoc_goc}</p>
            <textarea rows={4} defaultValue={modal.sua.bai_hoc} id="hoc-sua-txt" />
            <div className="hoc-modal-act">
              <button className="btn-ghost" onClick={() => setModal(null)}>Huỷ</button>
              <button className="btn-mini" onClick={() => duyetLo('sua', [modal.sua.id], document.getElementById('hoc-sua-txt').value)}>Lưu</button>
              <button className="btn-ai" onClick={() => duyetLo('duyet', [modal.sua.id], document.getElementById('hoc-sua-txt').value)}>Lưu &amp; duyệt</button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast {...toast} onHet={() => setToast(null)} />}
    </div>
  )
}
