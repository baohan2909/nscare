import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Spinner, Empty, Tt, Toast, LopPhu } from '../components/ui'
import { gioVN, fmtSdt } from '../lib/format'

const LOAI = { follow: ['Quan tâm mới', 'hoan'], unfollow: ['Bỏ quan tâm', 'klh'], nhan_tin: ['Khách nhắn tin', 'dang'] }

export default function MktPhanHoi() {
  const [ds, setDs] = useState([])
  const [tai, setTai] = useState(true)
  const [toast, setToast] = useState(null)
  const [lk, setLk] = useState(null)     // { id, sdt, dang }
  useEffect(() => { taiDs() }, [])
  async function taiDs() {
    setTai(true)
    try { setDs(await api.mktPhanHoi(150) || []) } catch (e) { console.error(e) } finally { setTai(false) }
  }
  async function xong(id) {
    try { await api.mktPhanHoiXong(id); taiDs() } catch (e) { setToast({ msg: e.message, kind: 'err' }) }
  }
  return (
    <>
      <div className="toolbar">
        <div style={{ fontWeight: 700 }}>Sự kiện &amp; phản hồi từ Zalo OA — trả lời khách trên app Zalo OA, đánh dấu xong ở đây</div>
        <div className="sp" />
        <button className="btn-ghost" onClick={taiDs}>Làm mới</button>
      </div>
      {tai ? <Spinner /> : ds.length === 0 ? <Empty text="Chưa có sự kiện nào (đấu webhook Zalo để nhận)" /> :
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th className="l">Thời điểm</th><th>Loại</th><th className="l">Khách</th>
              <th className="l">Nội dung</th><th>Xử lý</th></tr></thead>
            <tbody>
              {ds.map(e => {
                const [nhan, cls] = LOAI[e.loai] || [e.loai, 'cho']
                return (
                  <tr key={e.id} style={{ cursor: 'default', opacity: e.da_xu_ly ? .55 : 1 }}>
                    <td className="l">{gioVN(e.tao_luc)}</td>
                    <td><Tt cls={cls}>{nhan}</Tt></td>
                    <td className="l"><b>{e.ten || '(chưa liên kết)'}</b>
                      {e.sdt && <div className="kh-sdt">{fmtSdt(e.sdt)}</div>}</td>
                    <td className="l">{e.noi_dung || '—'}</td>
                    <td>
                      {!e.sdt && (e.loai === 'nhan_tin' || e.loai === 'follow') &&
                        <button className="btn-mini" onClick={() => setLk({ id: e.id, sdt: '', dang: false })}>Liên kết SĐT</button>}
                      {e.da_xu_ly ? ' ✓' :
                        <button className="btn-mini" onClick={() => xong(e.id)}>Đánh dấu xong</button>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>}
      {lk && (
        <LopPhu onClose={() => setLk(null)} rong={420}>
          <div className="lp-dau"><b>Liên kết số điện thoại với tài khoản Zalo này</b>
            <button className="lp-dong" onClick={() => setLk(null)}>✕</button></div>
          <div className="lp-than">
            <div className="nd-o"><label>Số điện thoại của khách</label>
              <input inputMode="tel" placeholder="VD: 0909xxxxxx" value={lk.sdt}
                onChange={e => setLk(s => ({ ...s, sdt: e.target.value }))} /></div>
            <div className="thu-luuy">Liên kết xong, khách này được đánh dấu <b>Quan tâm OA · Có Zalo ✓</b> —
              hệ thống gửi tin miễn phí cho khách được (trong cửa sổ 48h sau khi khách nhắn).</div>
          </div>
          <div className="lp-chan">
            <button className="btn-ghost" onClick={() => setLk(null)}>Huỷ</button>
            <button className="btn-ai" disabled={!lk.sdt.trim() || lk.dang} onClick={async () => {
              setLk(s => ({ ...s, dang: true }))
              try {
                await api.mktLienKetZalo(lk.id, lk.sdt.trim())
                setToast({ msg: 'Đã liên kết — giờ gửi thử được cho số này' }); setLk(null); taiDs()
              } catch (e) {
                setToast({ msg: e.message.indexOf('SDT') >= 0 ? 'Số không hợp lệ' : e.message, kind: 'err' })
                setLk(s => s && ({ ...s, dang: false }))
              }
            }}>{lk.dang ? 'Đang liên kết…' : 'Liên kết'}</button>
          </div>
        </LopPhu>
      )}
      {toast && <Toast msg={toast.msg} kind={toast.kind} onHet={() => setToast(null)} />}
    </>
  )
}
