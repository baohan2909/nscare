import { useEffect, useRef, useState, useCallback } from 'react'
import { api } from '../lib/api'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { gioVN, fmtSdt } from '../lib/format'
import { Spinner, Empty, Toast, LopPhu } from '../components/ui'
import { IcSend, IcRobot, IcSpark, IcImg, IcSmile, IcChat, IcDoc, IcPen, IcUser, IcSearch } from '../components/Icons'

const LOC = [
  { id: 'tat_ca', nhan: 'Tất cả', min: 'quan_ly' },
  { id: 'toi', nhan: 'Của tôi' },
  { id: 'chua_gan', nhan: 'Chưa nhận' },
  { id: 'chua_doc', nhan: 'Chưa đọc' }
]
const TT = { moi: 'Mới', dang_xu_ly: 'Đang xử lý', cho_khach: 'Chờ khách', xong: 'Xong' }
const tenKH = (h) => h?.ten || ('Khách #' + String(h?.zalo_user_id || '').slice(-4))
const EMOJI = ['😀','😊','😍','🥰','😁','😅','🤝','👍','👌','🙏','❤️','🔥','🎉','✨','💯','😢','😮','🤔','😎','🌟','🛵','🧢','👒','⛑️']

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
  const locSan = useRef(false)
  const [tim, setTim] = useState('')
  const [ds, setDs] = useState([])
  const [taiDs, setTaiDs] = useState(true)
  const [chon, setChon] = useState(null)
  const [tin, setTin] = useState([])
  const [taiTin, setTaiTin] = useState(false)
  const [oNhap, setONhap] = useState('')
  const [dangGui, setDangGui] = useState(false)
  const [mau, setMau] = useState([])
  const [panel, setPanel] = useState(null)          // 'mau' | 'emoji' | null
  const [aiGY, setAiGY] = useState(null)            // { ds: [] } | { tom_tat }
  const [aiDang, setAiDang] = useState(false)
  const [ai, setAi] = useState({ ai_tu_dong: false })
  const [hoSo, setHoSo] = useState(false)
  const [k360, setK360] = useState(null)
  const [suaKh, setSuaKh] = useState(null)
  const [toast, setToast] = useState(null)
  const cuonRef = useRef(null)
  const taRef = useRef(null)
  const fileRef = useRef(null)
  const chonRef = useRef(null)
  chonRef.current = chon

  // lọc mặc định theo vai trò — chỉ set MỘT LẦN, không đè lựa chọn của người dùng
  useEffect(() => {
    if (!locSan.current && laQuyen('quan_ly')) { locSan.current = true; setLoc('tat_ca') }
    else locSan.current = true
  }, [laQuyen])

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
    setChon(h); setAiGY(null); setPanel(null); setHoSo(false); setK360(null); setTaiTin(true)
    try { setTin(await api.htTin(h.id) || []) } catch (e) { /* im */ }
    setTaiTin(false)
    setDs(d => d.map(x => x.id === h.id ? { ...x, chua_doc: 0 } : x))
  }

  useEffect(() => {
    const ch = supabase
      .channel('ns-care-chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'care', table: 'ht_tin' }, (payload) => {
        const t = payload.new
        const c = chonRef.current
        if (c && t.hoi_thoai_id === c.id)
          setTin(prev => prev.some(x => x.id === t.id) ? prev : [...prev, t])
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

  // textarea tự cao theo nội dung
  function autoGrow() {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 170) + 'px'
  }
  useEffect(autoGrow, [oNhap])

  function chenText(t) {
    const el = taRef.current
    if (!el) { setONhap(v => v + t); return }
    const a = el.selectionStart ?? oNhap.length, b = el.selectionEnd ?? oNhap.length
    const moi = oNhap.slice(0, a) + t + oNhap.slice(b)
    setONhap(moi)
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = a + t.length })
  }

  async function gui(text, anhUrl) {
    const t = (text ?? oNhap).trim()
    if ((!t && !anhUrl) || !chon || dangGui) return
    setDangGui(true)
    const tam = { id: 'tam' + Date.now(), chieu: 'di', noi_dung: t, anh_url: anhUrl || null, nguoi_gui: user?.ma_nv, trang_thai: 'dang', tao_luc: new Date().toISOString() }
    setTin(prev => [...prev, tam]); setONhap(''); setAiGY(null); setPanel(null)
    try {
      const r = await api.guiNgay({ kieu: 'chat', hoi_thoai_id: chon.id, text: t, anh_url: anhUrl || null })
      setTin(prev => prev.filter(x => x.id !== tam.id))
      if (!r.ok) setToast({ msg: r.ma_loi === '-230' ? 'Ngoài 48h — khách cần nhắn lại trước' : 'Chưa gửi được (' + (r.ma_loi || r.loi) + ')', kind: 'err' })
    } catch (e) { setToast({ msg: e.message, kind: 'err' }); setTin(prev => prev.filter(x => x.id !== tam.id)) }
    setDangGui(false)
  }

  async function guiAnh(file) {
    if (!file || !chon) return
    if (file.size > 4 * 1024 * 1024) { setToast({ msg: 'Ảnh tối đa 4MB', kind: 'err' }); return }
    setDangGui(true); setToast({ msg: 'Đang tải ảnh lên…' })
    try {
      const duoi = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const path = chon.id + '/' + Date.now() + '.' + duoi
      const { error } = await supabase.storage.from('nscare-chat').upload(path, file, { upsert: false })
      if (error) throw error
      const { data } = supabase.storage.from('nscare-chat').getPublicUrl(path)
      setDangGui(false)
      await gui('', data.publicUrl)
    } catch (e) {
      setDangGui(false)
      setToast({ msg: 'Chưa tải được ảnh: ' + e.message, kind: 'err' })
    }
  }

  async function goiAI(cheDo) {
    if (!chon || aiDang) return
    setAiDang(true); setAiGY(null); setPanel(null)
    try {
      const r = await api.aiGoiY({ hoi_thoai_id: chon.id, che_do: cheDo })
      if (r.ok) setAiGY(cheDo === 'tom_tat' ? { tom_tat: r.tom_tat || (r.goi_y || [])[0] } : { ds: r.goi_y || [] })
      else setToast({ msg: r.loi === 'CHUA_CO_AI_KEY' ? 'Chưa bật AI (thiếu khóa API trên Vercel)' : 'AI chưa phản hồi được', kind: 'err' })
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
    try {
      await api.htCauHinhLuu({ ai_tu_dong: moi }); setAi(a => ({ ...a, ai_tu_dong: moi }))
      setToast({ msg: moi ? 'NS AI đang trực — tự trả lời khách chưa có người nhận' : 'NS AI đã tắt' })
    } catch (e) { setToast({ msg: e.message, kind: 'err' }) }
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
      {/* ══ CỘT DANH SÁCH ══ */}
      <div className="chat-ds">
        <div className="chat-ds-dau">
          <div className="chat-tim-o">
            <IcSearch size={15} />
            <input className="chat-tim" placeholder="Tìm tên / SĐT…" value={tim} onChange={e => setTim(e.target.value)} />
          </div>
          <select className="chat-loc-sel" value={loc} onChange={e => setLoc(e.target.value)}>
            {LOC.filter(l => !l.min || laQuyen(l.min)).map(l => <option key={l.id} value={l.id}>{l.nhan}</option>)}
          </select>
        </div>

        {laQuyen('quan_ly') &&
          <div className="ai-truc">
            <span className="ai-truc-ic"><IcRobot size={17} /></span>
            <div className="ai-truc-tx"><b>NS AI trực chat</b>
              <span>{ai.ai_tu_dong ? 'Đang tự trả lời khách chưa có người nhận' : 'Đang tắt — khách chờ nhân viên'}</span></div>
            <button className={'switch' + (ai.ai_tu_dong ? ' on' : '')} onClick={batTatAIToanCuc}
              aria-label="Bật tắt AI trực chat"><span className="switch-num" /></button>
          </div>}

        <div className="chat-ds-list">
          {taiDs ? <Spinner /> : ds.length === 0 ? <Empty text={loc === 'toi' ? 'Chưa có hội thoại gán cho bạn — đổi bộ lọc sang "Tất cả"' : 'Chưa có hội thoại'} /> :
            ds.map(h => (
              <div key={h.id} className={'chat-ds-item' + (chon?.id === h.id ? ' on' : '') + (h.chua_doc > 0 ? ' unread' : '')} onClick={() => moHt(h)}>
                {h.avatar_url
                  ? <img className="cdi-av anh" src={h.avatar_url} alt="" />
                  : <div className="cdi-av">{tenKH(h).replace('Khách #', 'K').slice(0, 1).toUpperCase()}</div>}
                <div className="cdi-mid">
                  <div className="cdi-ten"><span className="cdi-ten-tx">{tenKH(h)}</span>
                    {h.chua_doc > 0 && <span className="cdi-dot">{h.chua_doc}</span>}</div>
                  <div className="cdi-tin">{h.tin_cuoi || '—'}</div>
                </div>
                <div className="cdi-r">
                  <div className="cdi-gio">{h.tin_cuoi_luc ? gioVN(h.tin_cuoi_luc).slice(6) : ''}</div>
                  {h.phu_trach
                    ? <div className="cdi-pt">{h.phu_trach === user?.ma_nv ? 'Tôi' : (h.phu_trach_ten || h.phu_trach)}</div>
                    : ai.ai_tu_dong && !h.ai_tat ? <div className="cdi-pt ai"><IcRobot size={11} /> AI</div> : null}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* ══ KHUNG CHAT ══ */}
      {!chon ? (
        <div className="chat-rong"><IcChat size={44} /><p>Chọn một hội thoại để bắt đầu</p></div>
      ) : (
        <div className="chat-main">
          <div className="chat-main-dau">
            {chon.avatar_url ? <img className="cmd-av anh" src={chon.avatar_url} alt="" />
              : <div className="cmd-av">{tenKH(chon).replace('Khách #', 'K').slice(0, 1).toUpperCase()}</div>}
            <div className="cmd-info">
              <b className="cmd-ten">{tenKH(chon)}
                <button className="cmd-sua" title="Sửa tên / gắn SĐT"
                  onClick={() => setSuaKh({ ten: chon.ten || '', sdt: chon.sdt || '', dang: false })}><IcPen size={13} /></button></b>
              <span className="cmd-sub">
                {chon.sdt ? fmtSdt(chon.sdt) + ' · ' : 'Chưa gắn SĐT · '}
                {TT[chon.trang_thai] || chon.trang_thai}
                {chon.con_48h === false && <span className="cmd-het48"> · Ngoài 48h</span>}
              </span>
            </div>
            <div className="cmd-act">
              {ai.ai_tu_dong && !chon.phu_trach &&
                <button className={'nut-ai-ht' + (chon.ai_tat ? ' off' : '')} onClick={batTatAIHt}
                  title={chon.ai_tat ? 'AI đang tắt ở hội thoại này — bấm để bật' : 'AI đang trực hội thoại này — bấm để tắt'}>
                  <IcRobot size={14} /> {chon.ai_tat ? 'AI tắt' : 'AI trực'}</button>}
              {chon.phu_trach !== user?.ma_nv && <button className="btn-mini" onClick={nhanVe}>Nhận về tôi</button>}
              {chon.sdt && <button className="btn-mini" onClick={moHoSo}><IcUser size={13} /> Hồ sơ</button>}
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
                    {t.nguoi_gui === 'AI' && <span className="ct-ai-tag"><IcSpark size={11} /> NS AI</span>}
                    {t.anh_url ? <a href={t.anh_url} target="_blank" rel="noreferrer"><img className="ct-anh" src={t.anh_url} alt="" /></a> : null}
                    {t.noi_dung}
                    <div className="ct-meta">{gioVN(t.tao_luc)}
                      {t.chieu === 'di' && t.nguoi_gui && t.nguoi_gui !== 'AI' ? ' · ' + t.nguoi_gui : ''}
                      {t.trang_thai === 'dang' ? ' · đang gửi…' : t.trang_thai === 'loi' ? ' · ⚠ lỗi' : ''}</div>
                  </div>
                </div>
              ))}
              {!taiTin && tin.length === 0 && <Empty text="Chưa có tin nhắn — tin cũ trước lúc đấu nối webhook sẽ không hiển thị" />}
            </div>

            {hoSo && (
              <div className="chat-hoso">
                <div className="hs-dau"><b>Hồ sơ khách 360°</b><button className="lp-dong" onClick={() => setHoSo(false)}>✕</button></div>
                {!k360 ? <Spinner /> : k360.loi ? <Empty text="Chưa tải được hồ sơ" /> : k360.chua_mua ? <Empty text="Số này chưa có lịch sử mua tại Nón Sơn" /> : (
                  <div className="hs-than">
                    <div className="hs-o"><label>Khách</label><b>{k360.khach?.ten || tenKH(chon)}</b>
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

          {/* AI panel kết quả */}
          {aiGY && (
            <div className="ai-panel">
              <div className="ai-panel-dau"><IcSpark size={14} /> <b>NS AI {aiGY.tom_tat ? '— tóm tắt hội thoại' : 'đề xuất trả lời'}</b>
                <button className="lp-dong" onClick={() => setAiGY(null)}>✕</button></div>
              {aiGY.tom_tat
                ? <div className="ai-tomtat">{aiGY.tom_tat}</div>
                : (aiGY.ds || []).map((g, i) =>
                  <button key={i} className="ai-gy-nut" onClick={() => { setONhap(g); setAiGY(null); taRef.current?.focus() }}>{g}</button>)}
            </div>
          )}

          {/* panel mẫu câu / emoji */}
          {panel === 'mau' && (
            <div className="chat-panel">
              {mau.map(m => <button key={m.id} className="mau-nut" title={m.noi_dung}
                onClick={() => { chenText(m.noi_dung.replace('{ten}', chon.ten || 'anh/chị')); setPanel(null) }}>
                <b>{m.nhom}</b> · {m.tieu_de}</button>)}
            </div>
          )}
          {panel === 'emoji' && (
            <div className="chat-panel emoji">
              {EMOJI.map(e => <button key={e} className="emo" onClick={() => chenText(e)}>{e}</button>)}
            </div>
          )}

          {/* ══ COMPOSER ══ */}
          <div className="composer">
            {!canGui && <div className="cn-canh">Ngoài cửa sổ 48h — Zalo chỉ cho gửi khi khách nhắn lại</div>}
            <div className="composer-khung">
              <textarea ref={taRef} rows={1} className="composer-ta"
                placeholder={canGui ? 'Nhập tin nhắn cho khách… (Enter gửi · Shift+Enter xuống dòng)' : 'Chờ khách nhắn lại (ngoài 48h)'}
                value={oNhap} disabled={!canGui}
                onChange={e => setONhap(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); gui() } }} />
              <div className="composer-hang">
                <div className="composer-tools">
                  <button className={'tool' + (panel === 'emoji' ? ' on' : '')} title="Biểu tượng cảm xúc"
                    onClick={() => setPanel(p => p === 'emoji' ? null : 'emoji')}><IcSmile size={18} /></button>
                  <button className="tool" title="Gửi hình ảnh" onClick={() => fileRef.current?.click()}><IcImg size={18} /></button>
                  <input ref={fileRef} type="file" accept="image/*" hidden
                    onChange={e => { guiAnh(e.target.files?.[0]); e.target.value = '' }} />
                  <button className={'tool' + (panel === 'mau' ? ' on' : '')} title="Mẫu câu nghiệp vụ"
                    onClick={() => setPanel(p => p === 'mau' ? null : 'mau')}><IcDoc size={18} /></button>
                  <span className="tool-chia" />
                  <button className="tool ai" title="AI đề xuất câu trả lời" disabled={aiDang}
                    onClick={() => goiAI()}>{aiDang ? <span className="ai-cham"><i/><i/><i/></span> : <IcSpark size={18} />}<span className="tool-tx">Gợi ý</span></button>
                  <button className="tool ai" title="AI tóm tắt hội thoại" disabled={aiDang}
                    onClick={() => goiAI('tom_tat')}><IcDoc size={16} /><span className="tool-tx">Tóm tắt</span></button>
                </div>
                <button className="composer-gui" disabled={(!oNhap.trim()) || dangGui || !canGui} onClick={() => gui()}>
                  <IcSend size={17} /><span>Gửi</span>
                </button>
              </div>
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
            <div className="nd-o" style={{ marginTop: 10 }}><label>Số điện thoại (gắn hồ sơ mua hàng)</label>
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
