import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Card, SecTit, Spinner } from '../components/ui'

export default function MktTongQuan({ moMan }) {
  const [d, setD] = useState(null)
  useEffect(() => { api.mktTongQuan().then(setD).catch(() => setD({})) }, [])
  if (!d) return <Spinner />
  const pctFollow = d.tong_khach ? Math.round(d.follow / d.tong_khach * 1000) / 10 : 0
  return (
    <>
      <div className="row4">
        <div className="tq-lon"><div className="tq-lon-nhan">Kho khách hàng</div>
          <div className="tq-lon-so">{(d.tong_khach ?? 0).toLocaleString('vi')}</div>
          <span className="tq-delta tang">✓ Có Zalo: {(d.co_zalo ?? 0).toLocaleString('vi')} · ✗ Không: {(d.khong_zalo ?? 0).toLocaleString('vi')}</span></div>
        <div className="tq-bam" onClick={() => moMan?.('mkh')}>
          <div className="tq-lon"><div className="tq-lon-nhan">Đang quan tâm OA</div>
            <div className="tq-lon-so" style={{ color: 'var(--teal-deep)' }}>{(d.follow ?? 0).toLocaleString('vi')}</div>
            <span className="tq-delta tang">{pctFollow}% kho khách · +{d.follow_7ngay ?? 0} trong 7 ngày</span>
            <span className="tq-delta tang" style={{ color: '#1877F2' }}>Facebook: {(d.co_fb ?? 0).toLocaleString('vi')} khách · {(d.fb_24h ?? 0).toLocaleString('vi')} trong 24h</span></div></div>
        <div className="tq-bam" onClick={() => moMan?.('mcd')}>
          <div className="tq-lon"><div className="tq-lon-nhan">Chiến dịch đang chạy</div>
            <div className="tq-lon-so">{d.cd_dang_chay ?? 0}</div>
            <span className="tq-delta tang">Đã gửi hôm nay: {(d.gui_hom_nay ?? 0).toLocaleString('vi')} tin</span></div></div>
        <div className={'tq-bam'} onClick={() => moMan?.('mph')}>
          <div className={'tq-lon' + (d.phan_hoi_moi > 0 ? ' canh-bao' : '')}>
            <div className="tq-lon-nhan">Phản hồi chưa xử lý</div>
            <div className="tq-lon-so">{d.phan_hoi_moi ?? 0}</div>
            <span className={'tq-delta ' + (d.phan_hoi_moi > 0 ? 'giam' : 'tang')}>
              {d.phan_hoi_moi > 0 ? 'Khách đang chờ trả lời — bấm mở' : 'Đã trả lời hết'}</span></div></div>
      </div>

      <div className="grid-2">
        <Card className="pad">
          <SecTit phu="4 kênh Zalo + Facebook — hệ thống tự chọn cho từng khách">Cách hệ thống gửi tin</SecTit>
          <div className="mkt-kenh">
            <div className="k"><b>Tin tư vấn</b><span className="tt hoan">Miễn phí</span>
              <p>Khách đã nhắn OA trong 48 giờ. Tỉ lệ đọc cao nhất — hệ thống ưu tiên kênh này.</p></div>
            <div className="k"><b>Facebook Messenger</b><span className="tt hoan">Miễn phí</span>
              <p>Khách đã nhắn Fanpage trong 24 giờ. Đồng bộ chung hộp chat, AI trả lời tự động.</p></div>
            <div className="k"><b>Broadcast</b><span className="tt cho">Theo gói OA</span>
              <p>Gửi hàng loạt cho người quan tâm OA (hạn mức gói). Càng nhiều follow, kênh này càng mạnh.</p></div>
            <div className="k"><b>ZNS</b><span className="tt klh">Tính phí/tin</span>
              <p>Gửi theo SĐT bất kỳ (không cần follow) bằng mẫu đã Zalo duyệt — hợp thông báo, hậu mãi.</p></div>
          </div>
        </Card>
        <Card className="pad">
          <SecTit phu="chiến lược nuôi kênh miễn phí">Kéo khách quan tâm OA</SecTit>
          <div className="mkt-goiy">
            <div className="r"><span className="n">1</span>Nhân viên NS CARE gọi xong mời khách bấm quan tâm OA để nhận ưu đãi.</div>
            <div className="r"><span className="n">2</span>In mã QR OA vào hộp mũ + đặt tại 220 cửa hàng.</div>
            <div className="r"><span className="n">3</span>Chạy chiến dịch ZNS kèm nút "Quan tâm OA" — mỗi follow mới là một kênh miễn phí trọn đời.</div>
            <div className="r"><span className="n">✓</span>Hệ thống <b>tự nhận diện số có Zalo</b> qua mỗi chiến dịch: ZNS gửi tới → đánh dấu "Có Zalo ✓"; Zalo báo số không dùng → "Không Zalo" (khỏi tốn phí lần sau); khách quan tâm/nhắn tin → xác minh ngay.</div>
          </div>
        </Card>
      </div>
    </>
  )
}
