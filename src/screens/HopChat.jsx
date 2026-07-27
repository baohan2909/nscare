import { useEffect, useRef, useState, useCallback } from 'react'
import { api } from '../lib/api'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { gioVN, fmtSdt } from '../lib/format'
import { Spinner, Empty, Toast, LopPhu } from '../components/ui'
import { IcSend, IcMega } from '../components/Icons'

const LOC = [
  { id: 'tat_ca', nhan: 'Tất cả', min: 'quan_ly' },
  { id: 'toi', nhan: 'Của tôi' },
  { id: 'chua_gan', nhan: 'Chưa nhận' },
  { id: 'chua_doc', nhan: 'Chưa đọc' }
]
const TT = { moi: 'Mới', dang_xu_ly: 'Đang xử lý', cho_khach: 'Chờ khách', xong: 'Xong' }

// tiếng "ting" nhẹ khi có tin mới (không cần file âm thanh)
function ting() {
  try {
    const c = new (window.AudioContext || window.webkitAudioContext)()
    const o = c.createOscillator(), g = c.createGain()
    o.connect(g); g.connect(c.destination)
    o.frequency.value = 880; g.gain.setValueAtTime(0.08, c.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.35)
    o.start(); o.stop(c.currentTime + 0.36)
  } catch (e) { /* im lặng */ }
}

export default function HopChat() {
  const { user, laQuyen } = useAuth()
  const [loc, setLoc] = useState(() => 'toi')
  const [tim, setTim] = useState('')
  const [ds, setDs] = useState([])
  const [taiDs, setTaiDs] = useState(true)
  const [chon, setChon] = useState(null)
  const [tin, setTin] = useState([])
  const [taiTin, setTaiTin] = useState(false)
  const [oNhap, setONhap] = useState('')
  const [dangGui, setDangGui] = useState(false)
  const [mau, setMau] = useState([])
  const [hienMau, setHienMau] = useState(false)
  const [aiGY, setAiGY] = useState([])
  const [aiDang, setAiDang] = useState(false)
  const [ai, setAi] = useState({ ai_tu_dong: false })   // cấu hình AI toàn cục
  const [hoSo, setHoSo] = useState(false)                // panel khách 360
  const [k360, setK360] = useState(null)
  const [suaKh, setSuaKh] = useState(null)               // modal sửa tên/SĐT
  const [toast, setToast] = useState(null)
  const cuonRef = useRef(null)
  const chonRef = useRef(null)
  chonRef.current = chon

  // quan_ly mặc định xem Tất cả
  useEffect(() => { if (laQuyen('quan_ly')) setLoc('tat_ca') }, [laQuyen])

  const napDs = useCallback(async () => {
    try { setDs(await api.htDs(loc, tim) || []) } catch (e) { /* im */ }
    setTaiDs(false)
  }, [loc, tim])
  useEffect(() => { setTaiDs(true); napDs() }, [napDs])
  useEffect(() => {
    api.htMauCau().then(m => setMau(m || [])).catch(() => {})
    api.htCauHinh().then(c => setAi(c || { ai_tu_dong: false })).catch(() => {})
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission()
  }, [])

  async function moHt(h) {
    setChon(h); setAiGY([]); setHoSo(false); setK360(null); setTaiTin(true)
    try { setTin(await api.htTin(h.id) || []) } catch (e) { /* im */ }
    setTaiTin(false)
    setDs(d => d.map(x => x.id === h.id ? { ...x, chua_doc: 0 } : x))
  }

  // REALTIME + polling dự phòng 20s
  useEffect(() => {
    const ch = supabase
      .channel('ns-care-chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'care', table: 'ht_tin' }, (payload) => {
        const t = payload.new
        const c = chonRef.current
        if (c && t.hoi_thoai_id === c.id) {
          setTin(prev => prev.some(x => x.id === t.id) ? prev : [...prev, t])
        }
        if (t.chieu === 'den') {
          ting()
          if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
            try { new Notification('NS CARE — tin nhắn mới', { body: (t.noi_dung || '').slice(0, 80) }) } catch (e) { /* im */ }
          }
        }
        napDs()
      })
      .on('postgres_changes', { event: '*', schema: 'care', table: 'ht_hoi_thoai' }, () => napDs())
      .subscribe()
    const bo = setInterval(napDs, 20000)
    return () => { supabase.removeChannel(ch); clearInterval(bo) }
  }, [napDs])

  useEffect(() => { if (cuonRef.current) cuonRef.current.scrollTop = cuonRef.current.scrollHeight }, [tin, taiTin])

  async function gui(text) {
    const t = (text ?? oNhap).trim()
    if (!t || !chon || dangGui) return
    setDangGui(true)
    const tam = { id: 'tam' + Date.now(), chieu: 'di', noi_dung: t, nguoi_gui: user?.ma_nv, trang_thai: 'dang', tao_luc: new Date().toISOString() }
    setTin(prev => [...prev, tam]); setONhap(''); setAiGY([])
    try {
      const r = await api.guiNgay({ kieu: 'chat', hoi_thoai_id: chon.id, text: t })
      setTin(prev => prev.filter(x => x.id !== tam.id))
      if (!r.ok) setToast({ msg: r.ma_loi === '-230' ? 'Ngoài 48h — khách cần nhắn lại trước' : 'Chưa gửi được (' + (r.ma_loi || r.loi) + ')', kind: 'err' })
    } catch (e) { setToast({ msg: e.message, kind: 'err' }); setTin(prev => prev.filter(x => x.id !== tam.id)) }
    setDangGui(false)
  }

  async function goiYAI() {
    if (!chon || aiDang) return
    setAiDang(true); setAiGY([])
    try {
      const r = await api.aiGoiY({ hoi_thoai_id: chon.id })
      if (r.ok) setAiGY(r.goi_y || [])
      else setToast({ msg: r.loi === 'CHUA_CO_AI_KEY' ? 'Chưa bật AI (thiếu khóa API) — dùng mẫu câu' : 'AI chưa gợi ý được', kind: 'err' })
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
  async function batTatAIHt() {
    const moi = !chon.ai_tat
    try { await api.htAiTat(chon.id, moi); setChon(c => ({ ...c, ai_tat: moi })); napDs() }
    catch (e) { setToast({ msg: e.message, kind: 'err' }) }
  }
  async function batTatAIToanCuc() {
    if (!laQuyen('quan_ly')) return
    const moi = !ai.ai_tu_dong
    try { await api.htCauHinhLuu({ ai_tu_dong: moi }); setAi(a => ({ ...a, ai_tu_dong: moi }))
      setToast({ msg: moi ? '🤖 AI trực chat: ĐANG BẬT — tự trả lời khách chưa có người nhận' : 'AI trực chat: đã tắt' }) }
    catch (e) { setToast({ msg: e.message, kind: 'err' }) }
  }
  async function moHoSo() {
    setHoSo(v => !v)
    if (!k360 && chon?.sdt) {
      try { setK360(await api.khach360(chon.sdt)) }
      catch (e) { setK360(String(e.message).indexOf('KHONG_THAY_KHACH') >= 0 ? { chua_mua: true } : { loi: true }) }
    }
  }

  const canGui = chon && chon.con_48h !== false

  return (
    <div className="chat-wrap co-dinh">
      {/* ── DANH SÁCH ── */}
      <div className="chat-ds">
        <div className="chat-ds-dau">
          <input className="chat-tim" placeholder="Tìm tên / SĐT khách…" value={tim}
            onChange={e => setTim(e.target.value)} />
        </div>
        <div className="chat-loc">
          {LOC.filter(l => !l.min || laQuyen(l.min)).map(l =>
            <button key={l.id} className={'chat-loc-nut' + (loc === l.id ? ' on' : '')} onClick={() => setLoc(l.id)}>{l.nhan}</button>)}
        </div>
        {laQuyen('quan_ly') &&
          <button className={'chat-ai-toancuc' + (ai.ai_tu_dong ? ' on' : '')} onClick={batTatAIToanCuc}
            title="AI tự trả lời mọi hội thoại CHƯA có nhân viên nhận">
            🤖 AI trực chat: <b>{ai.ai_tu_dong ? 'BẬT' : 'Tắt'}</b>
          </button>}
        <div className="chat-ds-list">
          {taiDs ? <Spinner /> : ds.length === 0 ? <Empty text={loc === 'toi' ? 'Chưa có hội thoại nào gán cho bạn — xem tab "Chưa nhận" hoặc "Tất cả"' : 'Chưa có hội thoại'} /> :
            ds.map(h => (
              <div key={h.id} className={'chat-ds-item' + (chon?.id === h.id ? ' on' : '')} onClick={() => moHt(h)}>
                {h.avatar_url
                  ? <img className="cdi-av anh" src={h.avatar_url} alt="" />
                  : <div className="cdi-av">{(h.ten || 'K').slice(0, 1).toUpperCase()}</div>}
                <div className="cdi-mid">
                  <div className="cdi-ten"><span className="cdi-ten-tx">{h.ten || 'Khách Zalo'}</span>
                    {h.chua_doc > 0 && <span className="cdi-dot">{h.chua_doc}</span>}</div>
                  <div className="cdi-tin">{h.tin_cuoi || '—'}</div>
                </div>
                <div className="cdi-r">
                  <div className="cdi-gio">{h.tin_cuoi_luc ? gioVN(h.tin_cuoi_luc) : ''}</div>
                  {h.phu_trach
                    ? <div className="cdi-pt">{h.phu_trach === user?.ma_nv ? 'Tôi' : (h.phu_trach_ten || h.phu_trach)}</div>
                    : ai.ai_tu_dong && !h.ai_tat ? <div className="cdi-pt ai">🤖 AI trực</div> : null}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* ── KHUNG CHAT ── */}
      {!chon ? (
        <div className="chat-rong"><IcMega size={40} /><p>Chọn một hội thoại để bắt đầu</p></div>
      ) : (
        <div className="chat-main">
          <div className="chat-main-dau">
            {chon.avatar_url ? <img className="cmd-av anh" src={chon.avatar_url} alt="" />
              : <div className="cmd-av">{(chon.ten || 'K').slice(0, 1).toUpperCase()}</div>}
            <div className="cmd-info">
              <b className="cmd-ten">{chon.ten || 'Khách Zalo'}
                <button className="cmd-sua" title="Sửa tên / gắn SĐT"
                  onClick={() => setSuaKh({ ten: chon.ten || '', sdt: chon.sdt || '', dang: false })}>✎</button></b>
              <span className="cmd-sub">
                {chon.sdt ? fmtSdt(chon.sdt) + ' · ' : 'Chưa gắn SĐT · '}
                {TT[chon.trang_thai] || chon.trang_thai}
                {chon.con_48h === false && <span className="cmd-het48"> · Ngoài 48h</span>}
              </span>
            </div>
            <div className="cmd-act">
              {ai.ai_tu_dong && !chon.phu_trach &&
                <button className={'btn-mini ai-ht' + (chon.ai_tat ? ' off' : '')} onClick={batTatAIHt}
                  title={chon.ai_tat ? 'AI đang tắt ở hội thoại này' : 'AI đang trực hội thoại này'}>
                  {chon.ai_tat ? '🤖 AI: tắt' : '🤖 AI: trực'}</button>}
              {chon.phu_trach !== user?.ma_nv && <button className="btn-mini" onClick={nhanVe}>Nhận về tôi</button>}
              {chon.sdt && <button className="btn-mini" onClick={moHoSo}>{hoSo ? 'Đóng hồ sơ' : '👤 Hồ sơ 360°'}</button>}
              <select className="cmd-tt" value={chon.trang_thai} onChange={e => doiTT(e.target.value)}>
                {Object.entries(TT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          <div className="chat-than">
            <div className="chat-tin" ref={cuonRef}>
              {taiTin ? <Spinner /> : tin.map(t => (
                <div key={t.id} className={'ct-dong ' + (t.chieu === 'di' ? 'di' : 'den')}>
                  <div className={'ct-bong' + (t.nguoi_gui === 'AI' ? ' ai' : '')}>
                    {t.nguoi_gui === 'AI' && <span className="ct-ai-tag">🤖 AI</span>}
                    {t.anh_url ? <img className="ct-anh" src={t.anh_url} alt="" /> : null}
                    {t.noi_dung}
                    <div className="ct-meta">{gioVN(t.tao_luc)}
                      {t.chieu === 'di' && t.nguoi_gui && t.nguoi_gui !== 'AI' ? ' · ' + t.nguoi_gui : ''}
                      {t.trang_thai === 'dang' ? ' · đang gửi…' : t.trang_thai === 'loi' ? ' · ⚠ lỗi' : ''}</div>
                  </div>
                </div>
              ))}
              {!taiTin && tin.length === 0 && <Empty text="Chưa có tin nhắn" />}
            </div>

            {hoSo && (
              <div className="chat-hoso">
                <div className="hs-dau"><b>Hồ sơ khách 360°</b><button className="lp-dong" onClick={() => setHoSo(false)}>✕</button></div>
                {!k360 ? <Spinner /> : k360.loi ? <Empty text="Chưa tải được hồ sơ" /> : k360.chua_mua ? <Empty text="Số này chưa có lịch sử mua tại Nón Sơn" /> : (
                  <div className="hs-than">
                    <div className="hs-o"><label>Khách</label><b>{k360.khach?.ten || chon.ten || '—'}</b>
                      <span>{fmtSdt(chon.sdt)}</span></div>
                    <div className="hs-o"><label>Đơn hàng ({(k360.don || []).length})</label>
                      {(k360.don || []).slice(0, 5).map((o, i) =>
                        <div className="hs-don" key={i}>
                          <b>{o.don?.ma_don_ngoai || '—'}</b>
                          <span>{o.don?.ngay_mua ? gioVN(o.don.ngay_mua) : ''}</span>
                          <span className="hs-sp">{(o.san_pham || []).map(s => s.ten_sp).filter(Boolean).join(', ')}</span>
                        </div>)}
                      {(k360.don || []).length === 0 && <span className="hs-trong">Chưa có đơn</span>}
                    </div>
                    <div className="hs-o"><label>Ý kiến gần nhất</label>
                      {(k360.y_kien || []).slice(0, 3).map((y, i) =>
                        <div className="hs-don" key={i}><span className="hs-sp">{(y.noi_dung || y.y_kien || '').slice(0, 90)}</span>
                          <span>{y.tao_luc ? gioVN(y.tao_luc) : ''}</span></div>)}
                      {(k360.y_kien || []).length === 0 && <span className="hs-trong">Chưa có ý kiến</span>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {aiGY.length > 0 && (
            <div className="chat-ai-gy">
              {aiGY.map((g, i) => <button key={i} className="ai-gy-nut" onClick={() => setONhap(g)}>{g}</button>)}
            </div>
          )}
          {hienMau && (
            <div className="chat-mau">
              {mau.map(m => <button key={m.id} className="mau-nut" title={m.noi_dung}
                onClick={() => { setONhap(m.noi_dung.replace('{ten}', chon.ten || 'anh/chị')); setHienMau(false) }}>
                <b>{m.nhom}</b> · {m.tieu_de}</button>)}
            </div>
          )}

          <div className="chat-o-nhap">
            <div className="con-cong-cu">
              <button className={'ccc' + (hienMau ? ' on' : '')} onClick={() => setHienMau(v => !v)}>💬 Mẫu câu</button>
              <button className="ccc" onClick={goiYAI} disabled={aiDang}>✨ {aiDang ? 'Đang nghĩ…' : 'AI gợi ý'}</button>
              {!canGui && <span className="cn-canh">Ngoài cửa sổ 48h — khách cần nhắn lại mới gửi được</span>}
            </div>
            <div className="con-nhap">
              <textarea rows={1} placeholder={canGui ? 'Nhập tin nhắn… (Enter để gửi, Shift+Enter xuống dòng)' : 'Chờ khách nhắn lại (ngoài 48h)'}
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

      {suaKh && (
        <LopPhu onClose={() => setSuaKh(null)} rong={420}>
          <div className="lp-dau"><b>Thông tin khách</b>
            <button className="lp-dong" onClick={() => setSuaKh(null)}>✕</button></div>
          <div className="lp-than">
            <div className="nd-o"><label>Tên khách</label>
              <input value={suaKh.ten} onChange={e => setSuaKh(s => ({ ...s, ten: e.target.value }))} /></div>
            <div className="nd-o" style={{ marginTop: 10 }}><label>Số điện thoại (gắn hồ sơ, mở gửi thử/CSKH)</label>
              <input inputMode="tel" placeholder="VD: 0909xxxxxx" value={suaKh.sdt}
                onChange={e => setSuaKh(s => ({ ...s, sdt: e.target.value }))} /></div>
          </div>
          <div className="lp-chan">
            <button className="btn-ghost" onClick={() => setSuaKh(null)}>Huỷ</button>
            <button className="btn-ai" disabled={suaKh.dang} onClick={async () => {
              setSuaKh(s => ({ ...s, dang: true }))
              try {
                const r = await api.htSuaKhach(chon.id, suaKh.ten.trim() || null, suaKh.sdt.trim() || null)
                setChon(c => ({ ...c, ten: r?.ten || c.ten, sdt: r?.sdt || c.sdt }))
                setToast({ msg: 'Đã cập nhật thông tin khách' }); setSuaKh(null); napDs()
              } catch (e) {
                setToast({ msg: e.message.indexOf('SDT') >= 0 ? 'Số không hợp lệ' : e.message, kind: 'err' })
                setSuaKh(s => s && ({ ...s, dang: false }))
              }
            }}>{suaKh.dang ? 'Đang lưu…' : 'Lưu'}</button>
          </div>
        </LopPhu>
      )}
      {toast && <Toast msg={toast.msg} kind={toast.kind} onDone={() => setToast(null)} />}
    </div>
  )
}
