import { useEffect, useRef, useState, useCallback } from 'react'
import { api } from '../lib/api'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { gioVN } from '../lib/format'
import { Spinner, Empty, Toast } from '../components/ui'
import { IcSend, IcMega, IcUser } from '../components/Icons'

const LOC = [
  { id: 'toi', nhan: 'Của tôi' },
  { id: 'chua_gan', nhan: 'Chưa nhận' },
  { id: 'chua_doc', nhan: 'Chưa đọc' },
  { id: 'tat_ca', nhan: 'Tất cả', min: 'quan_ly' }
]
const TT = { moi: 'Mới', dang_xu_ly: 'Đang xử lý', cho_khach: 'Chờ khách', xong: 'Xong' }

export default function HopChat() {
  const { user, laQuyen } = useAuth()
  const [loc, setLoc] = useState('toi')
  const [tim, setTim] = useState('')
  const [ds, setDs] = useState([])
  const [taiDs, setTaiDs] = useState(true)
  const [chon, setChon] = useState(null)          // hội thoại đang mở
  const [tin, setTin] = useState([])
  const [taiTin, setTaiTin] = useState(false)
  const [oNhap, setONhap] = useState('')
  const [dangGui, setDangGui] = useState(false)
  const [mau, setMau] = useState([])
  const [hienMau, setHienMau] = useState(false)
  const [aiGY, setAiGY] = useState([])
  const [aiDang, setAiDang] = useState(false)
  const [toast, setToast] = useState(null)
  const cuonRef = useRef(null)

  const napDs = useCallback(async () => {
    setTaiDs(true)
    try { setDs(await api.htDs(loc, tim) || []) } catch (e) { /* im */ }
    setTaiDs(false)
  }, [loc, tim])

  useEffect(() => { napDs() }, [napDs])
  useEffect(() => { api.htMauCau().then(m => setMau(m || [])).catch(() => {}) }, [])

  // Mở hội thoại -> tải tin
  async function moHt(h) {
    setChon(h); setAiGY([]); setTaiTin(true)
    try { setTin(await api.htTin(h.id) || []) } catch (e) { /* im */ }
    setTaiTin(false)
    setDs(d => d.map(x => x.id === h.id ? { ...x, chua_doc: 0 } : x))
  }

  // REALTIME: nghe tin mới toàn schema, lọc theo hội thoại đang mở + làm tươi danh sách
  useEffect(() => {
    const ch = supabase
      .channel('ns-care-chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'care', table: 'ht_tin' }, (payload) => {
        const t = payload.new
        if (chon && t.hoi_thoai_id === chon.id) {
          setTin(prev => prev.some(x => x.id === t.id) ? prev : [...prev, {
            id: t.id, chieu: t.chieu, loai: t.loai, noi_dung: t.noi_dung,
            anh_url: t.anh_url, nguoi_gui: t.nguoi_gui, trang_thai: t.trang_thai, tao_luc: t.tao_luc
          }])
        }
        napDs()
      })
      .on('postgres_changes', { event: '*', schema: 'care', table: 'ht_hoi_thoai' }, () => napDs())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [chon, napDs])

  // tự cuộn xuống cuối khi có tin mới
  useEffect(() => { if (cuonRef.current) cuonRef.current.scrollTop = cuonRef.current.scrollHeight }, [tin])

  async function gui(text) {
    const t = (text ?? oNhap).trim()
    if (!t || !chon || dangGui) return
    setDangGui(true)
    // hiện lạc quan
    const tam = { id: 'tam' + Date.now(), chieu: 'di', noi_dung: t, nguoi_gui: user?.ma_nv, trang_thai: 'dang', tao_luc: new Date().toISOString() }
    setTin(prev => [...prev, tam]); setONhap(''); setAiGY([])
    try {
      const r = await api.guiNgay({ kieu: 'chat', hoi_thoai_id: chon.id, text: t })
      if (!r.ok) { setToast({ msg: r.ma_loi === '-230' ? 'Quá 48h — Zalo không cho gửi tư vấn' : 'Chưa gửi được (' + (r.ma_loi || r.loi) + ')', kind: 'err' }); setTin(prev => prev.filter(x => x.id !== tam.id)) }
      // realtime sẽ chèn tin thật; bỏ tin tạm
      else setTin(prev => prev.filter(x => x.id !== tam.id))
    } catch (e) { setToast({ msg: e.message, kind: 'err' }); setTin(prev => prev.filter(x => x.id !== tam.id)) }
    setDangGui(false)
  }

  async function goiYAI() {
    if (!chon || aiDang) return
    setAiDang(true); setAiGY([])
    try {
      const lich_su = tin.slice(-8).map(t => ({ chieu: t.chieu, noi_dung: t.noi_dung }))
      const r = await api.aiGoiY(lich_su, 3)
      if (r.ok) setAiGY(r.goi_y || [])
      else setToast({ msg: r.loi === 'CHUA_CO_AI_KEY' ? 'Chưa bật AI (thiếu khóa) — dùng mẫu câu bên dưới' : 'AI chưa gợi ý được', kind: 'err' })
    } catch (e) { setToast({ msg: e.message, kind: 'err' }) }
    setAiDang(false)
  }

  async function nhanVe() {
    try { await api.htGan(chon.id); setChon(c => ({ ...c, phu_trach: user?.ma_nv, trang_thai: 'dang_xu_ly' })); napDs() }
    catch (e) { setToast({ msg: e.message, kind: 'err' }) }
  }
  async function doiTT(tt) {
    try { await api.htTrangThai(chon.id, tt); setChon(c => ({ ...c, trang_thai: tt })); napDs() }
    catch (e) { setToast({ msg: e.message, kind: 'err' }) }
  }

  const canGui = chon && chon.con_48h !== false   // còn cửa sổ 48h (undefined coi như cho phép)

  return (
    <div className="chat-wrap">
      {/* ── CỘT TRÁI: danh sách hội thoại ── */}
      <div className="chat-ds">
        <div className="chat-ds-dau">
          <input className="chat-tim" placeholder="Tìm tên / SĐT khách…" value={tim}
            onChange={e => setTim(e.target.value)} />
        </div>
        <div className="chat-loc">
          {LOC.filter(l => !l.min || laQuyen(l.min)).map(l =>
            <button key={l.id} className={'chat-loc-nut' + (loc === l.id ? ' on' : '')} onClick={() => setLoc(l.id)}>{l.nhan}</button>)}
        </div>
        <div className="chat-ds-list">
          {taiDs ? <Spinner /> : ds.length === 0 ? <Empty text="Chưa có hội thoại" /> :
            ds.map(h => (
              <div key={h.id} className={'chat-ds-item' + (chon?.id === h.id ? ' on' : '')} onClick={() => moHt(h)}>
                <div className="cdi-av">{(h.ten || 'K').slice(0, 1).toUpperCase()}</div>
                <div className="cdi-mid">
                  <div className="cdi-ten">{h.ten || 'Khách Zalo'}{h.chua_doc > 0 && <span className="cdi-dot">{h.chua_doc}</span>}</div>
                  <div className="cdi-tin">{h.tin_cuoi || '—'}</div>
                </div>
                <div className="cdi-r">
                  <div className="cdi-gio">{h.tin_cuoi_luc ? gioVN(h.tin_cuoi_luc) : ''}</div>
                  {h.phu_trach && <div className="cdi-pt">{h.phu_trach === user?.ma_nv ? 'Tôi' : h.phu_trach_ten || h.phu_trach}</div>}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* ── CỘT PHẢI: khung chat ── */}
      {!chon ? (
        <div className="chat-rong"><IcMega size={40} /><p>Chọn một hội thoại để bắt đầu</p></div>
      ) : (
        <div className="chat-main">
          <div className="chat-main-dau">
            <div className="cmd-av">{(chon.ten || 'K').slice(0, 1).toUpperCase()}</div>
            <div className="cmd-info">
              <b>{chon.ten || 'Khách Zalo'}</b>
              <span className="cmd-sub">{chon.sdt ? chon.sdt + ' · ' : ''}{TT[chon.trang_thai] || chon.trang_thai}
                {chon.con_48h === false && <span className="cmd-het48"> · Ngoài 48h</span>}</span>
            </div>
            <div className="cmd-act">
              {chon.phu_trach !== user?.ma_nv && <button className="btn-mini" onClick={nhanVe}>Nhận về tôi</button>}
              <select className="cmd-tt" value={chon.trang_thai} onChange={e => doiTT(e.target.value)}>
                {Object.entries(TT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          <div className="chat-tin" ref={cuonRef}>
            {taiTin ? <Spinner /> : tin.map(t => (
              <div key={t.id} className={'ct-dong ' + (t.chieu === 'di' ? 'di' : 'den')}>
                <div className="ct-bong">
                  {t.noi_dung}
                  <div className="ct-meta">{gioVN(t.tao_luc)}{t.chieu === 'di' && t.nguoi_gui ? ' · ' + t.nguoi_gui : ''}{t.trang_thai === 'dang' ? ' · đang gửi…' : t.trang_thai === 'loi' ? ' · lỗi' : ''}</div>
                </div>
              </div>
            ))}
          </div>

          {/* gợi ý AI */}
          {aiGY.length > 0 && (
            <div className="chat-ai-gy">
              {aiGY.map((g, i) => <button key={i} className="ai-gy-nut" onClick={() => setONhap(g)}>{g}</button>)}
            </div>
          )}
          {/* mẫu câu */}
          {hienMau && (
            <div className="chat-mau">
              {mau.map(m => <button key={m.id} className="mau-nut" title={m.noi_dung}
                onClick={() => { setONhap(m.noi_dung.replace('{ten}', chon.ten || 'anh/chị')); setHienMau(false) }}>
                <b>{m.nhom}</b> · {m.tieu_de}</button>)}
            </div>
          )}

          <div className="chat-o-nhap">
            <div className="con-cong-cu">
              <button className={'ccc' + (hienMau ? ' on' : '')} onClick={() => setHienMau(v => !v)} title="Mẫu câu">💬 Mẫu câu</button>
              <button className="ccc" onClick={goiYAI} disabled={aiDang} title="AI gợi ý">✨ {aiDang ? 'Đang nghĩ…' : 'AI gợi ý'}</button>
              {!canGui && <span className="cn-canh">Ngoài cửa sổ 48h — khách cần nhắn lại mới gửi được</span>}
            </div>
            <div className="con-nhap">
              <textarea rows={1} placeholder={canGui ? 'Nhập tin nhắn…' : 'Chờ khách nhắn lại (ngoài 48h)'}
                value={oNhap} disabled={!canGui}
                onChange={e => setONhap(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); gui() } }} />
              <button className="con-gui" disabled={!oNhap.trim() || dangGui || !canGui} onClick={() => gui()}>
                <IcSend size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && <Toast msg={toast.msg} kind={toast.kind} onDone={() => setToast(null)} />}
    </div>
  )
}
