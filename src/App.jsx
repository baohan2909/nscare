import { useEffect, useState } from 'react'
import { useAuth } from './context/AuthContext'
import { api } from './lib/api'
import Sidebar from './components/Sidebar'
import Cmdbar from './components/Cmdbar'
import Login from './screens/Login'
import TongQuan from './screens/TongQuan'
import HangDoi from './screens/HangDoi'
import Phieu from './screens/Phieu'
import Khach360 from './screens/Khach360'
import PhanTich from './screens/PhanTich'
import BoCauHoi from './screens/BoCauHoi'
import QuanTri from './screens/QuanTri'
import NhapDon from './screens/NhapDon'
import MktTongQuan from './screens/MktTongQuan'
import MktKhach from './screens/MktKhach'
import MktChienDich from './screens/MktChienDich'
import MktMau from './screens/MktMau'
import MktPhanHoi from './screens/MktPhanHoi'

const NGAY = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
const META = {
  tq: ['Tổng quan', 'Chăm sóc khách hàng sau mua · ' + NGAY],
  hd: ['Hàng đợi chăm sóc', 'Danh sách phiếu cần liên hệ'],
  phieu: ['Phiếu chăm sóc', 'Thực hiện khảo sát khách hàng'],
  kh: ['Khách hàng 360°', 'Toàn bộ lịch sử mua & chăm sóc'],
  pt: ['Phân tích ý kiến', 'Tổng hợp ý kiến khách theo dòng sản phẩm'],
  bo: ['Bộ câu hỏi', 'Quản lý bộ câu hỏi có phiên bản'],
  admin: ['Quản trị', 'Cấu hình, tuân thủ & nhật ký hệ thống'],
  mtq: ['Marketing 360', 'Toàn cảnh tiếp thị Zalo OA · ' + NGAY],
  mcd: ['Chiến dịch Marketing', 'Tạo, chạy và đo lường chiến dịch Zalo'],
  mkh: ['Kho khách hàng', 'Dữ liệu khách đã làm sạch, sẵn sàng tiếp cận'],
  mmau: ['Mẫu tin Zalo', 'Soạn nội dung — xem trước như trên Zalo'],
  mph: ['Phản hồi Zalo', 'Quan tâm mới & tin nhắn khách gửi OA']
}

export default function App() {
  const { user } = useAuth()
  const [man, setMan] = useState('tq')
  const [phieuId, setPhieuId] = useState(null)
  const [nhapDon, setNhapDon] = useState(false)
  const [tabHd, setTabHd] = useState(null)
  const [badges, setBadges] = useState({})
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!user) return
    api.tongQuan().then(t => setBadges({ hangDoi: (t?.cho_goi_hom_nay || 0) + (t?.qua_han || 0) })).catch(() => {})
  }, [user, reload])

  if (!user) return <Login />

  const [tit, sub] = META[man] || META.tq
  const moPhieu = (id) => { setPhieuId(id); setMan('phieu') }
  const veHangDoi = () => { setMan('hd'); setReload(r => r + 1) }

  return (
    <div className="app">
      <Sidebar man={man} setMan={setMan} badges={badges} />
      <div className="main">
        <Cmdbar tit={tit} sub={sub} dongBo="Kết nối trực tiếp"
          onNhapDon={['tq', 'hd', 'kh'].includes(man) ? () => setNhapDon(true) : null} />
        {man === 'tq' && <TongQuan key={reload} moHangDoi={(t) => { setTabHd(t); setMan('hd') }} />}
        {man === 'hd' && <HangDoi moPhieu={moPhieu} tabDau={tabHd} key={reload + '-' + (tabHd || '')} />}
        {man === 'phieu' && <Phieu phieuId={phieuId} quayLai={veHangDoi} />}
        {man === 'kh' && <Khach360 />}
        {man === 'pt' && <PhanTich />}
        {man === 'bo' && <BoCauHoi />}
        {man === 'admin' && <QuanTri />}
        {man === 'mtq' && <MktTongQuan moMan={setMan} />}
        {man === 'mcd' && <MktChienDich />}
        {man === 'mkh' && <MktKhach />}
        {man === 'mmau' && <MktMau />}
        {man === 'mph' && <MktPhanHoi />}
      </div>
      {nhapDon && <NhapDon onClose={() => setNhapDon(false)} onXong={() => setReload(r => r + 1)} />}
    </div>
  )
}
