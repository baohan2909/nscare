import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { ZALO_GW_URL } from '../lib/config'
import { layToken } from '../lib/session'
import { Spinner, Toast } from '../components/ui'
import { IcRobot, IcSpark } from '../components/Icons'

const MODELS = [
  { id: 'claude-haiku-4-5', ten: 'Claude Haiku 4.5', mo: 'Nhanh · rẻ · văn phong tự nhiên — khuyên dùng cho chat CSKH' },
  { id: 'claude-sonnet-5', ten: 'Claude Sonnet 5', mo: 'Mạnh hơn · đắt hơn — cho tình huống phức tạp' }
]

export default function CauHinhAI() {
  const [tai, setTai] = useState(true)
  const [c, setC] = useState(null)
  const [luu, setLuu] = useState(false)
  const [toast, setToast] = useState(null)
  const [thu, setThu] = useState(null)   // kết quả thử AI

  useEffect(() => { api.htCauHinh().then(x => { setC(x || {}); setTai(false) }).catch(() => setTai(false)) }, [])

  async function luuCH() {
    setLuu(true)
    try { await api.htCauHinhLuu(c); setToast({ msg: 'Đã lưu cấu hình AI' }) }
    catch (e) { setToast({ msg: e.message, kind: 'err' }) }
    setLuu(false)
  }

  async function thuAI() {
    setThu({ dang: true })
    try {
      // gọi ai-goi-y với 1 hội thoại giả để kiểm khóa + model
      const r = await fetch(ZALO_GW_URL + '/ai-goi-y', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: layToken() || '', lich_su: [{ chieu: 'den', noi_dung: 'Mẫu nón này bao nhiêu tiền vậy shop?' }] })
      })
      const j = await r.json()
      if (j.ok) setThu({ ok: true, cau: (j.goi_y || [])[0] || '(AI phản hồi rỗng)' })
      else setThu({ ok: false, loi: j.loi === 'CHUA_CO_AI_KEY' ? 'Chưa có khóa API trên Vercel (ANTHROPIC_API_KEY)' : j.loi })
    } catch (e) { setThu({ ok: false, loi: e.message }) }
  }

  if (tai) return <Spinner />
  if (!c) return null

  return (
    <div className="chai-wrap">
      <div className="chai-head">
        <div className="chai-ic"><IcRobot size={22} /></div>
        <div>
          <h2>Cấu hình trợ lý AI</h2>
          <p>AI tự trả lời khách trên Zalo khi chưa có nhân viên nhận — không bỏ sót khách nào.</p>
        </div>
      </div>

      {/* Bật/tắt tổng */}
      <div className="chai-card">
        <div className="chai-row">
          <div><b>AI trực chat tự động</b>
            <span className="chai-sub">Khi bật, khách nhắn tới hội thoại chưa ai nhận sẽ được AI trả lời ngay lập tức theo tri thức bên dưới.</span></div>
          <button className={'switch' + (c.ai_tu_dong ? ' on' : '')} onClick={() => setC(s => ({ ...s, ai_tu_dong: !s.ai_tu_dong }))}><span className="switch-num" /></button>
        </div>
      </div>

      {/* Model */}
      <div className="chai-card">
        <label className="chai-label">Bộ máy AI</label>
        <div className="chai-models">
          {MODELS.map(m => (
            <button key={m.id} className={'chai-model' + (c.ai_model === m.id ? ' on' : '')}
              onClick={() => setC(s => ({ ...s, ai_model: m.id }))}>
              <b>{m.ten}</b><span>{m.mo}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Phong cách */}
      <div className="chai-card">
        <label className="chai-label">Phong cách trả lời</label>
        <textarea className="chai-ta" rows={2} value={c.ai_phong_cach || ''}
          onChange={e => setC(s => ({ ...s, ai_phong_cach: e.target.value }))} />
      </div>

      {/* Lời dặn */}
      <div className="chai-card">
        <label className="chai-label">Lời dặn riêng (giới hạn, việc cần chuyển nhân viên…)</label>
        <textarea className="chai-ta" rows={3} value={c.ai_loi_dan || ''}
          onChange={e => setC(s => ({ ...s, ai_loi_dan: e.target.value }))} />
      </div>

      {/* Tri thức nghiệp vụ */}
      <div className="chai-card">
        <label className="chai-label">Bộ não nghiệp vụ (nạp từ Cẩm nang chốt đơn CSKH)</label>
        <p className="chai-note">AI đọc phần này để trả lời chuẩn công thức 3 lớp, 5 bước chốt đơn, 5 cam kết thép, quy tắc câu chữ của Nón Sơn. Anh có thể sửa/bổ sung.</p>
        <textarea className="chai-ta mono" rows={10} value={c.ai_tri_thuc || ''}
          onChange={e => setC(s => ({ ...s, ai_tri_thuc: e.target.value }))} />
      </div>

      {/* Thử AI */}
      <div className="chai-card">
        <div className="chai-row">
          <div><b>Kiểm tra kết nối AI</b>
            <span className="chai-sub">Gửi thử một câu hỏi mẫu để xem AI đã hoạt động chưa.</span></div>
          <button className="btn-ai" onClick={thuAI} disabled={thu?.dang}><IcSpark size={15} /> {thu?.dang ? 'Đang thử…' : 'Thử ngay'}</button>
        </div>
        {thu && !thu.dang && (thu.ok
          ? <div className="chai-thu ok"><b>AI đã hoạt động ✓</b><div className="chai-thu-cau">“{thu.cau}”</div></div>
          : <div className="chai-thu loi"><b>Chưa chạy được</b><div>{thu.loi}</div>
              <div className="chai-huong">Cách bật: vào Vercel ▸ dự án zalooa ▸ Settings ▸ Environment Variables ▸ thêm <code>ANTHROPIC_API_KEY</code> = khóa API tại console.anthropic.com ▸ Redeploy.</div></div>)}
      </div>

      <div className="chai-luu">
        <button className="btn-ai lon" onClick={luuCH} disabled={luu}>{luu ? 'Đang lưu…' : 'Lưu cấu hình'}</button>
      </div>

      {toast && <Toast msg={toast.msg} kind={toast.kind} onDone={() => setToast(null)} />}
    </div>
  )
}
