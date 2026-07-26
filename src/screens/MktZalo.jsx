import { useState } from 'react'
import { api } from '../lib/api'
import { Card, SecTit, Toast } from '../components/ui'
import { WEBHOOK_APP_URL } from '../lib/config'

const B = [
  ['1', 'Tạo ứng dụng Zalo', <>Vào <a href="https://developers.zalo.me" target="_blank" rel="noreferrer">developers.zalo.me</a> ▸ <b>Thêm ứng dụng mới</b> (mô tả 20–500 ký tự). Bật ứng dụng ở góc phải trên.</>],
  ['2', 'Liên kết Official Account', <>Trong ứng dụng ▸ mục <b>Official Account</b> ▸ liên kết OA Nón Sơn của anh (anh phải là quản trị viên của cả App và OA).</>],
  ['3', 'Lấy 3 khoá & điền vào Apps Script', <>Vào ứng dụng lấy <b>App ID</b> và <b>App Secret Key</b>. Mở Apps Script ▸ ⚙ Project Settings ▸ Script Properties, thêm <code>ZALO_APP_ID</code> và <code>ZALO_APP_SECRET</code>.</>],
  ['4', 'Đặt Callback URL', <>Trong app Zalo ▸ <b>Official Account API</b> ▸ ô <b>Callback URL</b>, dán đúng link bên dưới rồi Cập nhật.</>],
  ['5', 'Bấm "Kết nối Zalo OA"', <>Bấm nút xanh bên dưới → màn Zalo hiện ra → <b>Cho phép</b>. Hệ thống tự lưu token và tự làm mới mỗi giờ — anh không phải làm gì thêm.</>],
  ['6', 'Đặt Webhook (nhận follow / tin nhắn)', <>Trong app Zalo ▸ <b>Webhook</b>, dán link webhook bên dưới, bật sự kiện <b>follow</b>, <b>unfollow</b>, <b>user_send_text</b>.</>]
]

export default function MktZalo() {
  const [kt, setKt] = useState(null)
  const [dangKt, setDangKt] = useState(false)
  const [toast, setToast] = useState(null)
  const base = WEBHOOK_APP_URL || '(chưa điền WEBHOOK_APP_URL trong config.js)'
  const urlOAuth = WEBHOOK_APP_URL + '?src=zalo_oauth'
  const urlWebhook = WEBHOOK_APP_URL + '?src=zalo'

  function chep(t) { navigator.clipboard?.writeText(t); setToast({ msg: 'Đã copy' }) }
  async function moKetNoi() {
    // Zalo yêu cầu bấm uỷ quyền qua trang permission của OA — mở tab để anh bấm Cho phép.
    // Link uỷ quyền chuẩn: oauth.zaloapp.com/v4/oa/permission?app_id=...&redirect_uri=callback
    setToast({ msg: 'Sau khi điền App ID vào Script Properties, dùng link uỷ quyền Zalo cung cấp trong app (mục OAuth) — callback đã trỏ sẵn về hệ thống.' })
  }
  async function kiemTra() {
    setDangKt(true); setKt(null)
    try { setKt(await api.mktZaloKiemTra()) }
    catch (e) { setKt({ ok: false, loi: e.message }) } finally { setDangKt(false) }
  }

  return (
    <>
      <Card className="pad">
        <SecTit phu="làm 1 lần — sau đó hệ thống tự vận hành, tự làm mới token">Kết nối Zalo Official Account</SecTit>
        {!WEBHOOK_APP_URL &&
          <div className="zalo-canhbao">Chưa điền <code>WEBHOOK_APP_URL</code> trong <b>src/lib/config.js</b>.
            Đó là link Web App của Apps Script (Deploy ▸ Web app ▸ /exec). Điền xong build lại repo rồi quay lại đây.</div>}

        <div className="zalo-buoc">
          {B.map(([n, tit, mo]) => (
            <div className="zb" key={n}>
              <div className="zb-n">{n}</div>
              <div className="zb-nd"><b>{tit}</b><div className="zb-mo">{mo}</div></div>
            </div>
          ))}
        </div>

        <div className="zalo-link">
          <label>Callback URL (dán vào bước 4)</label>
          <div className="zl-o"><input readOnly value={urlOAuth} /><button onClick={() => chep(urlOAuth)}>Copy</button></div>
          <label>Webhook URL (dán vào bước 6)</label>
          <div className="zl-o"><input readOnly value={urlWebhook} /><button onClick={() => chep(urlWebhook)}>Copy</button></div>
        </div>

        <div className="zalo-nut">
          <a className={'btn-ai' + (WEBHOOK_APP_URL ? '' : ' disabled')}
            href={WEBHOOK_APP_URL ? urlOAuth : undefined} target="_blank" rel="noreferrer">
            Kết nối Zalo OA →</a>
          <button className="btn-ghost" onClick={kiemTra} disabled={dangKt || !WEBHOOK_APP_URL}>
            {dangKt ? 'Đang kiểm tra…' : 'Kiểm tra kết nối'}</button>
        </div>

        {kt && (kt.ok
          ? <div className="zalo-ok">✓ Đã kết nối OA <b>{kt.oa}</b>{kt.follower != null ? ' · ' + Number(kt.follower).toLocaleString('vi') + ' người quan tâm' : ''}. Sẵn sàng gửi tin.</div>
          : <div className="zalo-loi">✗ Chưa kết nối được: {kt.loi}. Kiểm tra lại App ID / Secret / đã bấm Cho phép chưa.</div>)}
      </Card>
      {toast && <Toast msg={toast.msg} kind={toast.kind} onHet={() => setToast(null)} />}
    </>
  )
}
