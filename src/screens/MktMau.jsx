import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Card, SecTit, Spinner, Empty, Tt, Toast, LopPhu } from '../components/ui'

const LOAI = { media: 'Ảnh + chữ', article: 'Bài viết', zns: 'ZNS (theo SĐT)' }
const TT_MAU = { nhap: ['Nháp', 'cho'], san_sang: ['Sẵn sàng', 'hoan'], ngung: ['Ngừng', 'klh'] }

export default function MktMau() {
  const [ds, setDs] = useState([])
  const [tai, setTai] = useState(true)
  const [sua, setSua] = useState(null)      // mẫu đang soạn
  const [toast, setToast] = useState(null)

  useEffect(() => { taiDs() }, [])
  async function taiDs() {
    setTai(true)
    try { setDs(await api.mktMauDs() || []) } catch (e) { console.error(e) } finally { setTai(false) }
  }
  async function luu() {
    try {
      await api.mktMauLuu(sua)
      setToast({ msg: 'Đã lưu mẫu tin' }); setSua(null); taiDs()
    } catch (e) { setToast({ msg: e.message, kind: 'err' }) }
  }

  return (
    <>
      <div className="toolbar">
        <div style={{ fontWeight: 700 }}>Mẫu tin dùng cho chiến dịch — soạn 1 lần, gửi nhiều đợt</div>
        <div className="sp" />
        <button className="btn-ai" onClick={() => setSua({ loai: 'media', trang_thai: 'san_sang' })}>+ Soạn mẫu mới</button>
      </div>

      {tai ? <Spinner /> : ds.length === 0 ? <Empty text="Chưa có mẫu — bấm Soạn mẫu mới" /> :
        <div className="mkt-mau-luoi">
          {ds.map(m => {
            const [nhan, cls] = TT_MAU[m.trang_thai] || ['?', 'cho']
            return (
              <Card key={m.id} className="pad mkt-mau-card" onClick={() => setSua({ ...m })}>
                <div className="dau"><b>{m.ten}</b><Tt cls={cls}>{nhan}</Tt></div>
                <div className="loai">{LOAI[m.loai] || m.loai}{m.loai === 'zns' && m.zns_template_id ? ' · #' + m.zns_template_id : ''}</div>
                {m.anh_url && <img src={m.anh_url} alt="" loading="lazy" />}
                <div className="nd">{m.tieu_de && <b>{m.tieu_de}<br /></b>}{m.noi_dung}</div>
              </Card>
            )
          })}
        </div>}

      {sua && (
        <LopPhu onClose={() => setSua(null)} rong={760}>
          <div className="lp-dau"><b>{sua.id ? 'Sửa mẫu tin' : 'Soạn mẫu tin mới'}</b>
            <button className="lp-dong" onClick={() => setSua(null)}>✕</button></div>
          <div className="lp-than mkt-soan">
            <div className="trai">
              <div className="nd-o"><label>Tên mẫu (nội bộ)</label>
                <input value={sua.ten || ''} onChange={e => setSua(s => ({ ...s, ten: e.target.value }))}
                  placeholder="VD: Ra mắt MC040 tháng 8" /></div>
              <div className="nd-o"><label>Loại tin</label>
                <select value={sua.loai} onChange={e => setSua(s => ({ ...s, loai: e.target.value }))}>
                  {Object.entries(LOAI).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></div>
              {sua.loai === 'zns' &&
                <div className="nd-o"><label>ZNS Template ID (đã Zalo duyệt)</label>
                  <input value={sua.zns_template_id || ''} onChange={e => setSua(s => ({ ...s, zns_template_id: e.target.value }))}
                    placeholder="VD: 234567" /></div>}
              <div className="nd-o"><label>Tiêu đề</label>
                <input value={sua.tieu_de || ''} onChange={e => setSua(s => ({ ...s, tieu_de: e.target.value }))} /></div>
              <div className="nd-o"><label>Nội dung — dùng {'{ten}'} để cá nhân hoá</label>
                <textarea className="ta" rows={5} value={sua.noi_dung || ''}
                  onChange={e => setSua(s => ({ ...s, noi_dung: e.target.value }))}
                  placeholder={'Chào {ten}, Nón Sơn vừa ra mắt…'} /></div>
              <div className="nd-o"><label>Link ảnh sản phẩm / banner</label>
                <input value={sua.anh_url || ''} onChange={e => setSua(s => ({ ...s, anh_url: e.target.value }))}
                  placeholder="https://nonson.vn/…jpg" /></div>
              <div className="nd-o"><label>Trạng thái</label>
                <select value={sua.trang_thai} onChange={e => setSua(s => ({ ...s, trang_thai: e.target.value }))}>
                  <option value="nhap">Nháp</option><option value="san_sang">Sẵn sàng</option>
                  <option value="ngung">Ngừng</option></select></div>
            </div>
            <div className="phai">
              <div className="zalo-preview">
                <div className="zp-dau">Nón Sơn <span>Official Account</span></div>
                <div className="zp-body">
                  {sua.anh_url ? <img src={sua.anh_url} alt="" /> : <div className="zp-anh-trong">Ảnh sản phẩm</div>}
                  <div className="zp-bong">
                    {sua.tieu_de && <b>{sua.tieu_de}</b>}
                    <p>{(sua.noi_dung || 'Nội dung tin…').replace(/\{ten\}/g, 'Chị Lan')}</p>
                  </div>
                </div>
                <div className="zp-chu">Xem trước trên Zalo (mô phỏng)</div>
              </div>
            </div>
          </div>
          <div className="lp-chan">
            <button className="btn-ghost" onClick={() => setSua(null)}>Huỷ</button>
            <button className="btn-ai" disabled={!sua.ten || !sua.noi_dung} onClick={luu}>Lưu mẫu</button>
          </div>
        </LopPhu>
      )}
      {toast && <Toast msg={toast.msg} kind={toast.kind} onHet={() => setToast(null)} />}
    </>
  )
}
