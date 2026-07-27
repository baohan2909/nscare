import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Card, SecTit, Spinner, Empty, Tt, Toast, LopPhu } from '../components/ui'
import { gioVN } from '../lib/format'

const TT_CD = {
  nhap: ['Nháp', 'cho'], san_sang: ['Chờ chạy', 'cho'], dang_gui: ['Đang gửi', 'dang'],
  tam_dung: ['Tạm dừng', 'klh'], hoan_tat: ['Hoàn tất', 'hoan'], huy: ['Đã huỷ', 'klh']
}

export default function MktChienDich() {
  const [ds, setDs] = useState([])
  const [maus, setMaus] = useState([])
  const [tai, setTai] = useState(true)
  const [tao, setTao] = useState(null)
  const [dem, setDem] = useState(null)
  const [xem, setXem] = useState(null)      // chi tiết
  const [toast, setToast] = useState(null)

  useEffect(() => { taiDs() }, [])
  async function taiDs() {
    setTai(true)
    try {
      const [a, b] = await Promise.all([api.mktCdDs(), api.mktMauDs()])
      setDs(a || []); setMaus((b || []).filter(m => m.trang_thai === 'san_sang'))
    } catch (e) { console.error(e) } finally { setTai(false) }
  }

  async function demThu(p) {
    try { setDem(await api.mktDemPhanKhuc(p.pk_follow, p.pk_tinh, null)) } catch (e) { setDem(null) }
  }
  async function taoCd() {
    try {
      const p = { ...tao }
      if (p.pk_follow === 'chi_dinh') {
        p.pk_sdt_ds = (p.sdt_tho || '').split(/[\n,;\s]+/).map(x => x.trim()).filter(Boolean)
        p.pk_follow = 'tat_ca'
        delete p.sdt_tho
      }
      const id = await api.mktCdTao(p)
      await api.mktCdTrangThai(id, 'san_sang')            // duyệt chạy luôn
      setToast({ msg: 'Đã tạo chiến dịch — hệ thống sẽ gửi theo lịch trigger' })
      setTao(null); setDem(null); taiDs()
    } catch (e) { setToast({ msg: e.message, kind: 'err' }) }
  }
  async function doiTT(id, tt) {
    try { await api.mktCdTrangThai(id, tt); taiDs() } catch (e) { setToast({ msg: e.message, kind: 'err' }) }
  }
  async function moChiTiet(id) {
    try { setXem(await api.mktCdChiTiet(id)) } catch (e) { setToast({ msg: e.message, kind: 'err' }) }
  }

  return (
    <>
      <div className="toolbar">
        <div style={{ fontWeight: 700 }}>Chiến dịch Marketing — tạo, theo dõi, đo lường một chỗ</div>
        <div className="sp" />
        <button className="btn-ai" onClick={() => { setTao({ pk_follow: 'tat_ca', kenh: 'auto', gioi_han_ngay: 500 }); setDem(null) }}>
          + Tạo chiến dịch</button>
      </div>

      {tai ? <Spinner /> : ds.length === 0 ? <Empty text="Chưa có chiến dịch nào" /> :
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th className="l">Chiến dịch</th><th className="l">Mẫu tin</th>
              <th>Tiến độ</th><th>Đã gửi</th><th>Lỗi</th><th>Trạng thái</th><th>Điều khiển</th></tr></thead>
            <tbody>
              {ds.map(c => {
                const [nhan, cls] = TT_CD[c.trang_thai] || ['?', 'cho']
                const pct = c.tk_tong ? Math.round((c.tk_da_gui + c.tk_loi) / c.tk_tong * 100) : 0
                return (
                  <tr key={c.id} onClick={() => moChiTiet(c.id)}>
                    <td className="l"><b>{c.ten}</b></td>
                    <td className="l">{c.mau_ten || '—'}</td>
                    <td><div className="cd-bar"><div className="f" style={{ width: pct + '%' }} /></div>
                      <span className="cd-pct">{pct}%</span></td>
                    <td className="num">{(c.tk_da_gui || 0).toLocaleString('vi')}</td>
                    <td className="num">{c.tk_loi || 0}</td>
                    <td><Tt cls={cls}>{nhan}</Tt></td>
                    <td onClick={e => e.stopPropagation()}>
                      {c.trang_thai === 'dang_gui' &&
                        <button className="btn-mini" onClick={() => doiTT(c.id, 'tam_dung')}>Tạm dừng</button>}
                      {(c.trang_thai === 'tam_dung' || c.trang_thai === 'nhap') &&
                        <button className="btn-mini" onClick={() => doiTT(c.id, 'san_sang')}>Chạy tiếp</button>}
                      {c.trang_thai !== 'hoan_tat' && c.trang_thai !== 'huy' &&
                        <button className="btn-mini warn" onClick={() => doiTT(c.id, 'huy')}>Huỷ</button>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>}

      {tao && (
        <LopPhu onClose={() => setTao(null)} rong={520}>
          <div className="lp-dau"><b>Tạo chiến dịch mới</b>
            <button className="lp-dong" onClick={() => setTao(null)}>✕</button></div>
          <div className="lp-than">
            <div className="nd-o"><label>Tên chiến dịch</label>
              <input value={tao.ten || ''} onChange={e => setTao(s => ({ ...s, ten: e.target.value }))}
                placeholder="VD: Ra mắt MC040 — đợt 1" /></div>
            <div className="nd-o" style={{ marginTop: 10 }}><label>Mẫu tin</label>
              <select value={tao.mau_id || ''} onChange={e => setTao(s => ({ ...s, mau_id: e.target.value }))}>
                <option value="">— Chọn mẫu (soạn ở màn Mẫu tin) —</option>
                {maus.map(m => <option key={m.id} value={m.id}>{m.ten} ({m.loai})</option>)}
              </select></div>
            <div className="nd-o" style={{ marginTop: 10 }}><label>Tệp khách nhận</label>
              <select value={tao.pk_follow}
                onChange={e => { const v = e.target.value; setTao(s => ({ ...s, pk_follow: v })); if (v !== 'chi_dinh') demThu({ ...tao, pk_follow: v }) }}>
                <option value="tat_ca">Toàn bộ kho khách</option>
                <option value="follow">Chỉ người đang quan tâm OA</option>
                <option value="chua_follow">Chỉ người CHƯA quan tâm (đi ZNS)</option>
                <option value="chi_dinh">🧪 Danh sách SĐT chỉ định (test / nhóm nhỏ)</option>
              </select></div>
            {tao.pk_follow === 'chi_dinh' &&
              <div className="nd-o" style={{ marginTop: 10 }}>
                <label>Dán SĐT — mỗi dòng một số (hoặc cách nhau dấu phẩy)</label>
                <textarea className="ta" rows={4} placeholder={'0909xxxxxx\n0939xxxxxx'}
                  value={tao.sdt_tho || ''}
                  onChange={e => setTao(s => ({ ...s, sdt_tho: e.target.value }))} />
                <div className="mkt-dem" style={{ marginTop: 8 }}>
                  {(tao.sdt_tho || '').split(/[\n,;\s]+/).filter(x => x.trim()).length} số đã nhập —
                  hệ thống tự chuẩn hoá và loại số sai đầu số di động VN.</div>
              </div>}
            <div className="nd-o" style={{ marginTop: 10 }}><label>Lọc theo tỉnh (bỏ trống = toàn quốc)</label>
              <input value={tao.pk_tinh || ''} placeholder="VD: Hồ Chí Minh"
                onChange={e => setTao(s => ({ ...s, pk_tinh: e.target.value }))}
                onBlur={() => demThu(tao)} /></div>
            <div className="mkt-hang2">
              <div className="nd-o"><label>Trần số người (trống = hết tệp)</label>
                <input inputMode="numeric" value={tao.pk_gioi_han || ''}
                  onChange={e => setTao(s => ({ ...s, pk_gioi_han: e.target.value.replace(/\D/g, '') }))} /></div>
              <div className="nd-o"><label>Tối đa tin / ngày</label>
                <input inputMode="numeric" value={tao.gioi_han_ngay}
                  onChange={e => setTao(s => ({ ...s, gioi_han_ngay: e.target.value.replace(/\D/g, '') }))} /></div>
            </div>
            {dem && <div className="mkt-dem">Tệp hiện có <b>{Number(dem.tong).toLocaleString('vi')}</b> khách
              — {Number(dem.follow).toLocaleString('vi')} quan tâm OA (kênh miễn phí)
              · {Number(dem.chua_follow).toLocaleString('vi')} chưa quan tâm (cần ZNS)</div>}
          </div>
          <div className="lp-chan">
            <button className="btn-ghost" onClick={() => setTao(null)}>Huỷ</button>
            <button className="btn-ai" disabled={!tao.ten || !tao.mau_id} onClick={taoCd}>Tạo &amp; chạy</button>
          </div>
        </LopPhu>
      )}

      {xem && (
        <LopPhu onClose={() => setXem(null)} rong={480}>
          <div className="lp-dau"><b>{xem.cd?.ten}</b>
            <button className="lp-dong" onClick={() => setXem(null)}>✕</button></div>
          <div className="lp-than">
            <div className="kv-list">
              {Object.entries(xem.dem || {}).map(([k, v]) => (
                <div className="kv" key={k}><div className="k">{
                  { cho: 'Chờ gửi', dang: 'Đang gửi', da_gui: 'Đã gửi', loi: 'Lỗi', bo_qua: 'Bỏ qua (chưa có kênh)' }[k] || k
                }</div><span className="vbadge">{Number(v).toLocaleString('vi')}</span></div>
              ))}
              {Object.entries(xem.kenh || {}).map(([k, v]) => (
                <div className="kv" key={'k' + k}><div className="k">Qua kênh {
                  { tu_van: 'Tư vấn (miễn phí)', zns: 'ZNS', broadcast: 'Broadcast' }[k] || k
                }</div><span className="vbadge">{Number(v).toLocaleString('vi')}</span></div>
              ))}
              <div className="kv"><div className="k">Tạo lúc</div>
                <span className="vbadge">{gioVN(xem.cd?.tao_luc)}</span></div>
            </div>
          </div>
        </LopPhu>
      )}
      {toast && <Toast msg={toast.msg} kind={toast.kind} onHet={() => setToast(null)} />}
    </>
  )
}
