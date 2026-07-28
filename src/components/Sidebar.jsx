import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { APP_VERSION } from '../lib/config'
import { IcDash, IcPhone, IcUser, IcChart, IcForm, IcGear, IcChevL, IcOut, IcDown, IcMega, IcSend } from './Icons'

const NHOM = [
  { g: 'Chăm sóc', items: [
    { id: 'tq', nhan: 'Tổng quan', Ic: IcDash },
    { id: 'hd', nhan: 'Chăm sóc khách hàng', Ic: IcPhone, badgeKey: 'hangDoi' },
    { id: 'kh', nhan: 'Khách hàng 360°', Ic: IcUser }
  ]},
  { g: 'Marketing', items: [
    { id: 'mtq', nhan: 'Marketing 360', Ic: IcMega, min: 'quan_ly' },
    { id: 'mcd', nhan: 'Chiến dịch', Ic: IcSend, min: 'quan_ly' },
    { id: 'mkh', nhan: 'Kho khách hàng', Ic: IcUser, min: 'quan_ly' },
    { id: 'mmau', nhan: 'Mẫu tin Zalo', Ic: IcForm, min: 'quan_ly' },
    { id: 'mph', nhan: 'Phản hồi Zalo', Ic: IcPhone, min: 'quan_ly', badgeKey: 'mktPh' },
    { id: 'chat', nhan: 'Hộp chat Zalo', Ic: IcMega, min: 'cham_soc', badgeKey: 'chatChuaDoc' }
  ]},
  { g: 'Phân tích', items: [
    { id: 'pt', nhan: 'Phân tích ý kiến', Ic: IcChart, min: 'quan_ly' }
  ]},
  { g: 'Thiết lập', items: [
    { id: 'bo', nhan: 'Bộ câu hỏi', Ic: IcForm, min: 'quan_ly' },
    { id: 'chai', nhan: 'Cấu hình AI', Ic: IcMega, min: 'quan_ly' },
    { id: 'admin', nhan: 'Quản trị', Ic: IcGear, min: 'admin' }
  ]}
]

export default function Sidebar({ man, setMan, badges = {} }) {
  const [gon, setGon] = useState(false)
  const [caiDat, setCaiDat] = useState(null)   // sự kiện beforeinstallprompt
  const [daCai, setDaCai] = useState(false)
  const { user, dangXuat, laQuyen } = useAuth()
  const active = man === 'phieu' ? 'hd' : man

  useEffect(() => {
    const mm = window.matchMedia('(display-mode: standalone)')
    if (mm.matches || window.navigator.standalone) setDaCai(true)
    const h = (e) => { e.preventDefault(); setCaiDat(e) }
    const done = () => setDaCai(true)
    window.addEventListener('beforeinstallprompt', h)
    window.addEventListener('appinstalled', done)
    return () => { window.removeEventListener('beforeinstallprompt', h); window.removeEventListener('appinstalled', done) }
  }, [])

  async function taiApp() {
    if (caiDat) {                                 // Chrome/Edge PC: cài trực tiếp
      caiDat.prompt(); const r = await caiDat.userChoice
      if (r && r.outcome === 'accepted') setDaCai(true)
      setCaiDat(null); return
    }
    const ua = navigator.userAgent
    if (/safari/i.test(ua) && !/chrome|edg/i.test(ua)) {
      alert('Safari: menu Chia sẻ \u25b8 "Th\u00eam v\u00e0o Dock" (ho\u1eb7c "Th\u00eam v\u00e0o MH ch\u00ednh") \u0111\u1ec3 c\u00e0i NS CARE nh\u01b0 \u1ee9ng d\u1ee5ng.')
    } else {
      alert('C\u00e0i NS CARE l\u00ean m\u00e1y t\u00ednh: m\u1edf b\u1eb1ng Chrome ho\u1eb7c Edge, b\u1ea5m bi\u1ec3u t\u01b0\u1ee3ng C\u00e0i \u0111\u1eb7t (m\u00e0n h\u00ecnh c\u00f3 m\u0169i t\u00ean \u2913) \u1edf g\u00f3c ph\u1ea3i thanh \u0111\u1ecba ch\u1ec9 \u25b8 C\u00e0i \u0111\u1eb7t. App ch\u1ea1y nh\u01b0 ph\u1ea7n m\u1ec1m ri\u00eang, c\u00f3 icon tr\u00ean desktop.')
    }
  }

  return (
    <aside className={'sidebar' + (gon ? ' gon' : '')}>
      <button className="side-toggle" onClick={() => setGon(g => !g)} title="Thu gọn">
        <IcChevL size={14} style={{ transform: gon ? 'rotate(180deg)' : 'none' }} />
      </button>
      <div className="side-logo">
        <div className="mark">NS</div>
        <div className="tx"><div className="t">NS CARE</div>
          <div className="s">Chăm sóc khách hàng</div>
          <div className="ver">v{APP_VERSION}</div></div>
      </div>

      <nav className="side-nav">
        {NHOM.map(nh => {
          const items = nh.items.filter(it => !it.min || laQuyen(it.min))
          if (!items.length) return null
          return (
            <div key={nh.g}>
              <div className="side-group">{nh.g}</div>
              {items.map(it => (
                <div key={it.id}
                     className={'side-item' + (active === it.id ? ' on' : '')}
                     onClick={() => setMan(it.id)}>
                  <it.Ic size={19} />
                  <span className="side-txt">{it.nhan}</span>
                  {it.badgeKey && badges[it.badgeKey] > 0 &&
                    <span className="badge-dot">{badges[it.badgeKey]}</span>}
                </div>
              ))}
            </div>
          )
        })}
      </nav>

      {!daCai &&
        <button className="side-install" onClick={taiApp}>
          <IcDown size={15} /><span className="side-txt">Tải ứng dụng (PC)</span>
        </button>}

      <div className="side-user">
        <div className="av">{(user?.ten || 'A').slice(0, 1).toUpperCase()}</div>
        <div className="tx">
          <div className="n">{user?.ten || user?.ma_nv}</div>
          <div className="r">{user?.ma_nv} · {vaiTro(user?.vai_tro)}</div>
        </div>
        <button className="side-out-ic" onClick={dangXuat} title="Đăng xuất"><IcOut size={16} /></button>
      </div>
    </aside>
  )
}
function vaiTro(v) { return ({ admin: 'Quản trị', quan_ly: 'Quản lý', cham_soc: 'Chăm sóc' })[v] || v }
