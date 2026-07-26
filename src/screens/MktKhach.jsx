import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Spinner, Empty, Tt } from '../components/ui'
import { IcSearch } from '../components/Icons'
import { fmtSdt } from '../lib/format'

export default function MktKhach() {
  const [rows, setRows] = useState([])
  const [tong, setTong] = useState(0)
  const [tai, setTai] = useState(true)
  const [tim, setTim] = useState('')
  const [follow, setFollow] = useState('')
  const [trang, setTrang] = useState(0)
  const SO = 50

  useEffect(() => { const t = setTimeout(taiDs, 300); return () => clearTimeout(t) }, [tim, follow, trang])
  async function taiDs() {
    setTai(true)
    try {
      const r = await api.mktKhachDs(tim.trim() || null, follow || null, null, trang, SO) || []
      setRows(r); setTong(Number(r[0]?.tong || 0))
    } catch (e) { console.error(e) } finally { setTai(false) }
  }
  const soTrang = Math.max(1, Math.ceil(tong / SO))

  return (
    <>
      <div className="toolbar">
        <div className="tim-o"><IcSearch size={15} />
          <input placeholder="Tìm tên hoặc SĐT…" value={tim}
            onChange={e => { setTim(e.target.value); setTrang(0) }} /></div>
        {[['', 'Tất cả'], ['follow', 'Quan tâm OA'], ['co_zalo', 'Có Zalo ✓'], ['khong_zalo', 'Không Zalo'], ['chua', 'Chưa quan tâm']].map(([v, n]) => (
          <div key={v} className={'nhom-tab' + (follow === v ? ' on' : '')}
            onClick={() => { setFollow(v); setTrang(0) }}>{n}</div>
        ))}
        <div className="sp" />
        <span className="mkt-tongso">{tong.toLocaleString('vi')} khách</span>
      </div>

      {tai ? <Spinner /> : rows.length === 0 ? <Empty text="Không có khách khớp bộ lọc" /> : <>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th className="l">Khách hàng</th><th className="l">SĐT</th>
              <th className="l">Tỉnh</th><th className="l">Địa chỉ</th><th>Zalo</th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} style={{ cursor: 'default' }}>
                  <td className="l"><b>{r.ten || '(chưa có tên)'}</b></td>
                  <td className="l">{fmtSdt(r.sdt)}</td>
                  <td className="l">{r.tinh || '—'}</td>
                  <td className="l" style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.dia_chi || '—'}</td>
                  <td>{r.zalo_follow ? <Tt cls="hoan">Quan tâm OA</Tt>
                    : r.zalo_tt === 'co_zalo' ? <Tt cls="cho">Có Zalo ✓</Tt>
                    : r.zalo_tt === 'khong_zalo' ? <Tt cls="klh">Không Zalo</Tt>
                    : <Tt cls="klh">Chưa rõ</Tt>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="phan-trang">
          <button className="btn-ghost" disabled={trang === 0} onClick={() => setTrang(t => t - 1)}>‹ Trước</button>
          <span>Trang {trang + 1} / {soTrang.toLocaleString('vi')}</span>
          <button className="btn-ghost" disabled={trang + 1 >= soTrang} onClick={() => setTrang(t => t + 1)}>Sau ›</button>
        </div>
      </>}
    </>
  )
}
