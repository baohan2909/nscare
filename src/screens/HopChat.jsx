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
  const [theDs, setTheDs] = useState([])
  const [nvDs, setNvDs] = useState([])
  const [panelThe, setPanelThe] = useState(false)
  const [hoiPhamVi, setHoiPhamVi] = useState(false)
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

  const [locThe, setLocThe] = useState('')
  const napDs = useCallback(async () => {
    try { setDs(await api.htDs(loc, tim, locThe) || []) } catch (e) { /* im */ }
    setTaiDs(false)
  }, [loc, tim, locThe])
  useEffect(() => { setTaiDs(true); napDs() }, [napDs])
  useEffect(() => {
    api.htMauCau().then(m => setMau(m || [])).catch(() => {})
    api.htCauHinh().then(c => setAi(c || { ai_tu_dong: false })).catch(() => {})
    api.htTheDs().then(t => setTheDs(t || [])).catch(() => {})
    if (laQuyen('quan_ly')) api.htNhanVien().then(n => setNvDs(n || [])).catch(() => {})
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission()
  }, [])

  async function moHt(h) {
    setChon(h); setAiGY(null); setPanel(null); setHoSo(false); setK360(null); setTaiTin(true)
    try { setTin(await api.htTin(h.id) || []) } catch (e) { /* im */ }
    setTaiTin(false)
    setDs(d => d.map(x => x.id === h.id ? { ...x, chua_doc: 0 } : x))
    if (!h.ten || !h.avatar_url) layTen(h.id, true)   // tự lấy tên/ảnh Zalo nếu thiếu
  }

  async function layTen(htId, imLang) {
    try {
      const r = await api.guiNgay({ kieu: 'lay_ten', hoi_thoai_id: htId })
      if (r.ok) {
        setChon(c => c && c.id === htId ? { ...c, ten: r.ten || c.ten, avatar_url: r.avatar || c.avatar_url } : c)
        napDs()
        if (!imLang) setToast({ msg: 'Đã lấy tên từ Zalo: ' + (r.ten || '(không có tên)') })
      } else if (!imLang) {
        setToast({ msg: 'Zalo không trả tên (' + (r.loi || '') + (r.zalo ? ' — ' + r.zalo : '') + '). Khách chưa Quan tâm OA thì Zalo không cho tên — dùng nút ✎ gõ tay.', kind: 'err' })
      }
    } catch (e) { if (!imLang) setToast({ msg: e.message, kind: 'err' }) }
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
      .on('postgres_changes', { event: '*', schema: 'care', table: 'ht_hoi_thoai' }, (p) => {
        napDs()
        const c = chonRef.current
        if (c && p.new && p.new.id === c.id) {
          api.htTin(c.id).then(m => m && setTin(m)).catch(() => {})
        }
      })
      .subscribe()
    const bo = setInterval(napDs, 20000)
    return () => { supabase.removeChannel(ch); clearInterval(bo) }
  }, [napDs])

  const oDayRef = useRef(true)
  useEffect(() => {
    if (oDayRef.current && cuonRef.current) cuonRef.current.scrollTop = cuonRef.current.scrollHeight
  }, [tin, taiTin])
  function onCuon(e) {
    const el = e.currentTarget
    oDayRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 90
  }
  // khi mở hội thoại mới thì luôn về đáy
  useEffect(() => { oDayRef.current = true }, [chon?.id])

  // Nạp lại tin của hội thoại đang mở mỗi 8s — bảo đảm tin AI/OA/anh gửi đều hiện
  // kể cả khi realtime chưa kịp đẩy về.
  useEffect(() => {
    if (!chon) return
    const t = setInterval(async () => {
      try {
        const moi = await api.htTin(chon.id)
        setTin(prev => {
          if (!moi) return prev
          const idPrev = prev.filter(x => typeof x.id === 'number').map(x => x.id)
          const idMoi = moi.map(x => x.id)
          // chỉ đè khi có tin mới hoặc số lượng khác (tránh nháy vô ích)
          if (idMoi.length !== idPrev.length || idMoi.some(id => !idPrev.includes(id))) return moi
          return prev
        })
      } catch (e) { /* im */ }
    }, 8000)
    return () => clearInterval(t)
  }, [chon])

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
  // hội thoại này có đang được AI trực không (theo phạm vi)
  function aiDangTrucHt(h) {
    if (!ai.ai_tu_dong || !h || h.phu_trach) return false
    return ai.ai_pham_vi === 'tuy_chon' ? !!h.ai_bat : !h.ai_tat
  }
  async function batTatAIHt() {
    if (!ai.ai_tu_dong) {
      setToast({ msg: 'AI đang tắt toàn hệ thống. Bật công tắc "NS AI trực chat" ở cột trái để dùng.', kind: 'err' })
      return
    }
    if (chon.phu_trach) {
      setToast({ msg: 'Hội thoại này đã có người phụ trách nên AI không tự trả lời. Bỏ phụ trách thì AI trực lại.' })
      return
    }
    const dangTruc = aiDangTrucHt(chon)
    const bat = !dangTruc
    try {
      await api.htAiHoiThoai(chon.id, bat)
      setChon(c => ai.ai_pham_vi === 'tuy_chon' ? { ...c, ai_bat: bat } : { ...c, ai_tat: !bat }); napDs()
      setToast({ msg: bat ? 'AI trực hội thoại này' : 'Đã tắt AI ở hội thoại này — bạn tự trả lời' })
    } catch (e) { setToast({ msg: e.message, kind: 'err' }) }
  }
  function gatAI() {
    if (!laQuyen('quan_ly')) return
    if (ai.ai_tu_dong) { luuAI(false, ai.ai_pham_vi) }   // đang bật → tắt luôn
    else setHoiPhamVi(true)                               // đang tắt → hỏi phạm vi rồi bật
  }
  async function luuAI(bat, phamVi) {
    try {
      await api.htCauHinhLuu({ ai_tu_dong: bat, ai_pham_vi: phamVi })
      setAi(a => ({ ...a, ai_tu_dong: bat, ai_pham_vi: phamVi })); setHoiPhamVi(false)
      setToast({ msg: !bat ? 'NS AI đã tắt' : phamVi === 'tuy_chon' ? 'NS AI bật — chỉ trả lời hội thoại bạn chọn' : 'NS AI bật — trả lời tất cả khách chưa ai nhận' })
    } catch (e) { setToast({ msg: e.message, kind: 'err' }) }
  }
  async function moHoSo() {
    setHoSo(v => !v)
    if (!k360 && chon?.sdt) {
      try { setK360(await api.khach360(chon.sdt)) }
      catch (e) { setK360(String(e.message).indexOf('KHONG_THAY_KHACH') >= 0 ? { chua_mua: true } : { loi: true }) }
    }
  }
  async function toggleThe(ten) {
    const cur = chon.nhan || []
    const moi = cur.includes(ten) ? cur.filter(x => x !== ten) : [...cur, ten]
    try { await api.htGanThe(chon.id, moi); setChon(c => ({ ...c, nhan: moi })); napDs() }
    catch (e) { setToast({ msg: e.message, kind: 'err' }) }
  }
  async function toggleUuTien() {
    const moi = !chon.uu_tien
    try { await api.htUuTien(chon.id, moi); setChon(c => ({ ...c, uu_tien: moi })); napDs() }
    catch (e) { setToast({ msg: e.message, kind: 'err' }) }
  }
  async function chuyenNV(ma) {
    try { await api.htGan(chon.id, ma); const nv = nvDs.find(x => x.ma_nv === ma)
      setChon(c => ({ ...c, phu_trach: ma, phu_trach_ten: nv?.ten })); napDs()
      setToast({ msg: 'Đã chuyển cho ' + (nv?.ten || ma) }) }
    catch (e) { setToast({ msg: e.message, kind: 'err' }) }
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
        {theDs.length > 0 &&
          <div className="chat-loc-the">
            {theDs.filter(t => t.ten !== 'Bảo hành').map(t => <button key={t.id} className={'the-loc' + (locThe === t.ten ? ' on' : '')}
              style={locThe === t.ten ? { background: t.mau, borderColor: t.mau, color: '#fff' } : { borderColor: t.mau, color: t.mau }}
              onClick={() => setLocThe(locThe === t.ten ? '' : t.ten)}>{t.ten}</button>)}
          </div>}

        {laQuyen('quan_ly') &&
          <div className={'ai-truc' + (ai.ai_tu_dong ? ' on' : '')}>
            <span className={'ai-truc-ic' + (ai.ai_tu_dong ? ' song' : '')}><IcSpark size={16} /></span>
            <div className="ai-truc-tx"><b>NS AI trực chat</b>
              <span>{!ai.ai_tu_dong ? 'AI trả lời khách tự động' : ai.ai_pham_vi === 'tuy_chon' ? 'Chế độ: chỉ hội thoại bạn chọn' : 'Chế độ: tất cả khách chưa ai nhận'}</span></div>
            <button className={'switch' + (ai.ai_tu_dong ? ' on' : '')} onClick={gatAI}
              aria-label="Bật tắt AI trực chat"><span className="switch-num" /></button>
          </div>}

        <div className="chat-ds-list">
          {taiDs ? <Spinner /> : ds.length === 0 ? <Empty text={loc === 'toi' ? 'Chưa có hội thoại gán cho bạn — đổi bộ lọc sang "Tất cả"' : 'Chưa có hội thoại'} /> :
            ds.map(h => (
              <div key={h.id} className={'chat-ds-item' + (chon?.id === h.id ? ' on' : '') + (h.chua_doc > 0 ? ' unread' : '') + (aiDangTrucHt(h) ? ' ai-truc-item' : '')} onClick={() => moHt(h)}>
                {h.avatar_url
                  ? <img className="cdi-av anh" src={h.avatar_url} alt="" />
                  : <div className="cdi-av">{tenKH(h).replace('Khách #', 'K').slice(0, 1).toUpperCase()}</div>}
                <div className="cdi-mid">
                  <div className="cdi-ten">{h.uu_tien && <span className="cdi-sao">★</span>}<span className="cdi-ten-tx">{tenKH(h)}</span>
                    {h.chua_doc > 0 && <span className="cdi-dot">{h.chua_doc}</span>}</div>
                  <div className="cdi-tin">{h.tin_cuoi || '—'}</div>
                  <div className="cdi-meta-row">
                    {aiDangTrucHt(h) && <span className="cdi-ai-badge"><span className="cham-song" /> AI đang trực</span>}
                    {h.phu_trach && <span className="cdi-nv-badge">{h.phu_trach === user?.ma_nv ? 'Tôi phụ trách' : (h.phu_trach_ten || h.phu_trach)}</span>}
                    {(h.nhan || []).slice(0, 2).map(nh => {
                      const t = theDs.find(x => x.ten === nh)
                      return <span key={nh} className="cdi-the-chip" style={{ background: (t?.mau || '#1E5F63') + '1a', color: t?.mau || '#1E5F63' }}>{nh}</span>
                    })}
                  </div>
                </div>
                <div className="cdi-r">
                  <div className="cdi-gio">{h.tin_cuoi_luc ? gioVN(h.tin_cuoi_luc).slice(6) : ''}</div>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* ══ KHUNG CHAT ══ */}
      {!chon ? (
        <div className="chat-rong"><IcChat size={44} /><p>Chọn một hội thoại để bắt đầu</p></div>
      ) : (
        <div className={'chat-main' + (aiDangTrucHt(chon) ? ' ai-dang-truc' : '')}>
          <div className="chat-main-dau">
            {chon.avatar_url ? <img className="cmd-av anh" src={chon.avatar_url} alt="" />
              : <div className="cmd-av">{tenKH(chon).replace('Khách #', 'K').slice(0, 1).toUpperCase()}</div>}
            <div className="cmd-info">
              <b className="cmd-ten"><span className="cmd-ten-tx">{tenKH(chon)}</span>
                <button className="cmd-sua" title="Sửa tên / gắn SĐT"
                  onClick={() => setSuaKh({ ten: chon.ten || '', sdt: chon.sdt || '', dang: false })}><IcPen size={13} /></button>
                <button className="cmd-sua" title="Lấy lại tên + ảnh từ Zalo" onClick={() => layTen(chon.id, false)}>↻</button></b>
              <span className="cmd-sub">
                {chon.sdt ? fmtSdt(chon.sdt) + ' · ' : 'Chưa gắn SĐT · '}
                {TT[chon.trang_thai] || chon.trang_thai}
                {chon.con_48h === false && <span className="cmd-het48"> · Ngoài 48h</span>}
              </span>
            </div>
            <div className="cmd-act">
              <button className={'cmd-sao' + (chon.uu_tien ? ' on' : '')} onClick={toggleUuTien} title="Đánh dấu ưu tiên">★</button>
              <button className={'btn-mini' + (panelThe ? ' on' : '')} onClick={() => setPanelThe(v => !v)} title="Gắn thẻ">🏷 Thẻ</button>
              {laQuyen('quan_ly') && nvDs.length > 0 &&
                <select className="cmd-tt" value={chon.phu_trach || ''} onChange={e => e.target.value && chuyenNV(e.target.value)} title="Chuyển nhân viên">
                  <option value="">Chuyển NV…</option>
                  {nvDs.map(n => <option key={n.ma_nv} value={n.ma_nv}>{n.ten}</option>)}
                </select>}
              <button className={'nut-ai-ht ' + (aiDangTrucHt(chon) ? 'truc' : (ai.ai_tu_dong && !chon.phu_trach) ? 'tat' : 'nghi')} onClick={batTatAIHt}
                title={!ai.ai_tu_dong ? 'AI tổng đang tắt (bật ở cột trái)' : chon.phu_trach ? 'Hội thoại đã có người phụ trách nên AI không tự trả lời' : aiDangTrucHt(chon) ? 'AI đang TRỰC hội thoại này — bấm để tắt, tự trả lời' : 'AI đang TẮT ở hội thoại này — bấm để AI tự trả lời'}>
                {aiDangTrucHt(chon) ? <span className="cham-song" /> : <IcSpark size={13} />}
                {aiDangTrucHt(chon) ? 'AI đang trực' : (ai.ai_tu_dong && !chon.phu_trach) ? 'AI: tắt' : 'AI: nghỉ'}</button>
              {chon.phu_trach !== user?.ma_nv && <button className="btn-mini" onClick={nhanVe}>Nhận về tôi</button>}
              {chon.sdt && <button className="btn-mini" onClick={moHoSo}><IcUser size={13} /> Hồ sơ</button>}
              <select className="cmd-tt" value={chon.trang_thai} onChange={e => doiTT(e.target.value)}>
                {Object.entries(TT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          {aiDangTrucHt(chon) &&
            <div className="ai-banner"><span className="cham-song" /> NS AI đang tự động trả lời hội thoại này — bấm <b>“AI đang trực”</b> để tắt và tự trả lời</div>}

          {panelThe && (
            <div className="the-panel">
              {theDs.filter(t => t.ten !== 'Bảo hành').map(t => {
                const on = (chon.nhan || []).includes(t.ten)
                return <button key={t.id} className={'the-chip' + (on ? ' on' : '')}
                  style={on ? { background: t.mau, borderColor: t.mau, color: '#fff' } : { borderColor: t.mau, color: t.mau }}
                  onClick={() => toggleThe(t.ten)}>{on ? '✓ ' : ''}{t.ten}</button>
              })}
            </div>
          )}

          <div className="chat-than">
            <div className="chat-tin" ref={cuonRef} onScroll={onCuon}>
             <div className="chat-tin-in">
              {taiTin ? <Spinner /> : tin.map((t, i) => {
                const truoc = tin[i - 1]
                const ngayMoi = !truoc || String(t.tao_luc).slice(0, 10) !== String(truoc.tao_luc).slice(0, 10)
                const dauCum = !truoc || truoc.chieu !== t.chieu || truoc.nguoi_gui !== t.nguoi_gui || ngayMoi
                const laAI = t.nguoi_gui === 'AI'
                return (
                  <div key={t.id}>
                    {ngayMoi && <div className="ct-ngay"><span>{gioVN(t.tao_luc).slice(6)}</span></div>}
                    <div className={'ct-dong ' + (t.chieu === 'di' ? 'di' : 'den') + (dauCum ? ' dau' : '')}>
                      {t.chieu === 'den' && (dauCum
                        ? (chon.avatar_url ? <img className="ct-av" src={chon.avatar_url} alt="" /> : <span className="ct-av chu">{tenKH(chon).replace('Khách #', 'K').slice(0, 1)}</span>)
                        : <span className="ct-av-spacer" />)}
                      <div className={'ct-bong' + (laAI ? ' ai' : '')}>
                        {laAI && <span className="ct-ai-tag"><IcSpark size={11} /> NS AI</span>}
                        {t.anh_url ? <a href={t.anh_url} target="_blank" rel="noreferrer"><img className="ct-anh" src={t.anh_url} alt="" /></a> : null}
                        {t.noi_dung}
                        <div className="ct-meta">{gioVN(t.tao_luc).slice(0, 5)}
                          {t.chieu === 'di' && t.nguoi_gui === 'OA' ? ' · từ Zalo OA' : t.chieu === 'di' && !laAI && t.nguoi_gui ? ' · ' + t.nguoi_gui : ''}
                          {t.trang_thai === 'dang' ? ' · đang gửi…' : t.trang_thai === 'loi' ? ' · ⚠ lỗi' : ''}</div>
                      </div>
                      {t.chieu === 'di' && (dauCum
                        ? (laAI ? <span className="ct-av ai" title="NS AI"><IcSpark size={15} /></span>
                            : <span className="ct-av nv" title={t.nguoi_gui || 'Nhân viên'}>{(t.nguoi_gui === 'OA' ? 'OA' : (t.nguoi_gui || 'NV')).slice(0, 2).toUpperCase()}</span>)
                        : <span className="ct-av-spacer" />)}
                    </div>
                  </div>
                )
              })}
              {!taiTin && tin.length === 0 && <Empty text="Chưa có tin nhắn — tin cũ trước lúc đấu nối webhook sẽ không hiển thị" />}
             </div>
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
              <div className="ai-panel-dau"><IcSpark size={14} /> <b>NS AI {aiGY.tom_tat ? '— Tóm tắt hội thoại' : '— Gợi ý trả lời'}</b>
                <button className="ai-panel-dong" onClick={() => setAiGY(null)}>Đóng ✕</button></div>
              {aiGY.tom_tat
                ? <div className="ai-tomtat">{aiGY.tom_tat}</div>
                : (aiGY.ds || []).map((g, i) =>
                  <button key={i} className="ai-gy-nut" onClick={() => { setONhap(g); setAiGY(null); taRef.current?.focus() }}>{g}</button>)}
            </div>
          )}

          {/* panel mẫu câu / emoji */}
          {panel === 'mau' && (
            <div className="chat-panel-mau">
              {Object.entries(mau.reduce((g, m) => { (g[m.nhom] = g[m.nhom] || []).push(m); return g }, {})).map(([nhom, ds]) => (
                <div className="mau-nhom" key={nhom}>
                  <div className="mau-nhom-ten">{nhom.replace(/^\d+\.\s*/, '')}</div>
                  <div className="mau-nhom-ds">
                    {ds.map(m => <button key={m.id} className="mau-nut" title={m.noi_dung}
                      onClick={() => { chenText(m.noi_dung.replace('{ten}', chon.ten || 'anh/chị')); setPanel(null) }}>
                      {m.tieu_de}</button>)}
                  </div>
                </div>
              ))}
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

      {hoiPhamVi && (
        <LopPhu onClose={() => setHoiPhamVi(false)} rong={440}>
          <div className="lp-dau"><b>Bật NS AI trực chat</b>
            <button className="lp-dong" onClick={() => setHoiPhamVi(false)}>✕</button></div>
          <div className="lp-than">
            <p className="pv-hoi">Anh muốn AI trả lời phạm vi nào?</p>
            <button className="pv-chon" onClick={() => luuAI(true, 'tat_ca')}>
              <span className="pv-ic"><IcSpark size={18} /></span>
              <div><b>Bật cho tất cả</b><span>AI tự trả lời mọi khách nhắn tới khi chưa có nhân viên nhận.</span></div>
            </button>
            <button className="pv-chon" onClick={() => luuAI(true, 'tuy_chon')}>
              <span className="pv-ic"><IcUser size={18} /></span>
              <div><b>Tùy chọn từng hội thoại</b><span>AI chỉ trả lời những hội thoại bạn bật thủ công (bằng nút “AI” trong khung chat).</span></div>
            </button>
          </div>
        </LopPhu>
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
