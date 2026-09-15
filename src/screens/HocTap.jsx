import { useEffect, useState, useCallback } from 'react'
import { api } from '../lib/api'
import { ZALO_GW_URL } from '../lib/config'
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
  const [modal, setModal] = useState(null)    // 'cauhinh' | {sua: bài}
  const [apDung, setApDung] = useState(null)  // tab đang áp dụng
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
    setChay({ dang: true, cham: 0, bai: 0 })
    let tongCham = 0, tongBai = 0
    try {
      for (let i = 0; i < 12; i++) {
        const r = await fetch(ZALO_GW_URL + '/hoc-runner?nguon=tay', { method: 'POST' })
        const j = await r.json().catch(() => ({}))
        if (j.chay === false) { setToast({ msg: j.ly_do === 'TAT' ? 'Học tập đang tắt' : 'Một lượt khác đang chạy', kind: 'err' }); break }
        tongCham += j.so_cham || 0; tongBai += j.so_bai_moi || 0
        setChay({ dang: true, cham: tongCham, bai: tongBai, con: j.con_lai })
        if (j.loi) setToast({ msg: 'Có lỗi: ' + String(j.loi).slice(0, 120), kind: 'err' })
        if (!j.con_lai || (j.so_cham || 0) === 0) break
      }
      setToast({ msg: `Xong: chấm ${tongCham} hội thoại, ${tongBai} bài học mới` })
    } catch (e) { setToast({ msg: e.message, kind: 'err' }) }
    setChay(null); nap()
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
            ? <div className="hoc-prog"><IcRefresh size={16} className="quay" /> Đang chấm… {chay.cham} hội thoại · {chay.bai} bài</div>
            : <button className="btn-ai" onClick={hocNgay}><IcSpark size={16} /> Học ngay</button>}
          <div className="hoc-lo">
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
      </div>

      {tab === 'apdung' ? (
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
                {b.trang_thai === 'da_duyet' && <span className="hoc-dd"><IcCheck size={13} /> Đã duyệt</span>}
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
            <input type="range" min="2" max="12" value={cf.so_ht_moi_luot || 6}
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
