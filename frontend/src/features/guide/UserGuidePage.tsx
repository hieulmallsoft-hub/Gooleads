import {
  BarChart3,
  Bot,
  CheckCircle2,
  CircleHelp,
  History,
  Image,
  KeyRound,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

const guideSections = [
  { id: 'bat-dau', label: 'Bắt đầu', icon: CheckCircle2 },
  { id: 'chien-dich', label: 'Xem chiến dịch', icon: BarChart3 },
  { id: 'ai', label: 'Dùng AI', icon: Bot },
  { id: 'thay-doi', label: 'Thay nội dung', icon: Sparkles },
  { id: 'do-luong', label: 'Đo lường', icon: History },
  { id: 'quyen', label: 'Phân quyền', icon: ShieldCheck },
  { id: 'xu-ly-loi', label: 'Xử lý lỗi', icon: CircleHelp },
];

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <li className="guideStep">
      <span>{number}</span>
      <div><strong>{title}</strong><p>{children}</p></div>
    </li>
  );
}

function Callout({ number, text }: { number: number; text: string }) {
  return <div className="guideCallout"><span>{number}</span><strong>{text}</strong></div>;
}

function AccountVisual() {
  return (
    <figure className="guideVisual">
      <div className="guideMockTopbar">
        <div className="guideMockLogo">GG Ads</div>
        <div className="guideMockControl marked"><span className="guideMarker">1</span>ID khách hàng: 3577896837</div>
        <div className="guideMockControl marked"><span className="guideMarker">2</span>14 ngày</div>
        <button className="guideMockPrimary marked" type="button"><span className="guideMarker">3</span>Tải dữ liệu</button>
      </div>
      <div className="guideCalloutList">
        <Callout number={1} text="Chọn đúng tài khoản Google Ads" />
        <Callout number={2} text="Chọn khoảng thời gian cần xem" />
        <Callout number={3} text="Bấm Tải dữ liệu" />
      </div>
      <figcaption>Ảnh 1 — Chọn tài khoản và tải dữ liệu</figcaption>
    </figure>
  );
}

function CampaignVisual() {
  return (
    <figure className="guideVisual">
      <div className="guideMockShell">
        <div className="guideMockSidebar">
          <span>Tổng quan</span>
          <strong className="marked"><span className="guideMarker">1</span>Chiến dịch</strong>
          <span>Nhóm quảng cáo</span>
          <span>Tài nguyên</span>
        </div>
        <div className="guideMockMain">
          <div className="guideMockSearch marked"><span className="guideMarker">2</span>Tìm tên hoặc ID chiến dịch</div>
          <div className="guideMockTable">
            <div className="guideMockTableHead"><span>Chiến dịch</span><span>CTR</span><span>Giá trị CĐ / chi phí</span></div>
            <div className="guideMockTableRow marked"><span className="guideMarker">3</span><strong>Chiến dịch tìm kiếm AC</strong><span>6.87%</span><span>173.00%</span></div>
          </div>
        </div>
      </div>
      <div className="guideCalloutList">
        <Callout number={1} text="Mở danh sách Chiến dịch" />
        <Callout number={2} text="Tìm nhanh theo tên hoặc ID" />
        <Callout number={3} text="Bấm vào dòng để mở nhóm quảng cáo" />
      </div>
      <figcaption>Ảnh 2 — Tìm và mở một chiến dịch</figcaption>
    </figure>
  );
}

function AiVisual() {
  return (
    <figure className="guideVisual">
      <div className="guideMockPanel">
        <div className="guideMockPanelHead"><div><strong>Đề xuất nội dung bằng AI</strong><span>3 nội dung hiệu quả thấp</span></div><button className="marked" type="button"><span className="guideMarker">1</span>Tạo đề xuất AI</button></div>
        <div className="guideMockSuggestion">
          <label className="marked"><span className="guideMarker">2</span><input type="checkbox" readOnly /> Phê duyệt</label>
          <div><small>Hiện tại</small><strong>Điều khiển TV miễn phí</strong></div>
          <div><small>Đề xuất AI</small><strong>Ứng dụng điều khiển TV miễn phí</strong></div>
        </div>
        <div className="guideMockFooter"><label className="marked"><span className="guideMarker">3</span><input type="checkbox" readOnly /> Tôi đã kiểm tra nội dung</label><button type="button">Tạo bản xem trước</button></div>
      </div>
      <div className="guideCalloutList">
        <Callout number={1} text="Bấm để AI tạo đề xuất" />
        <Callout number={2} text="Chọn đề xuất muốn sử dụng" />
        <Callout number={3} text="Xác nhận sau khi xem nội dung cũ và mới" />
      </div>
      <figcaption>Ảnh 3 — Tạo và phê duyệt đề xuất AI</figcaption>
    </figure>
  );
}

function TrackingVisual() {
  return (
    <figure className="guideVisual">
      <div className="guideMockTracking">
        <div className="guideMockTabs"><strong className="marked"><span className="guideMarker">1</span>Hiệu quả sau thay đổi</strong><span>Lịch sử thay đổi</span></div>
        <div className="guideMockTrackingActions">
          <select aria-label="Khoảng ngày minh họa"><option>14 ngày</option></select>
          <button className="marked" type="button"><span className="guideMarker">2</span>Đồng bộ Google Ads</button>
        </div>
        <div className="guideMockResults">
          <div><span>Hiệu quả tăng</span><strong>4</strong></div>
          <div><span>Hiệu quả giảm</span><strong>1</strong></div>
          <div><span>Đang chờ dữ liệu</span><strong>8</strong></div>
        </div>
        <div className="guideMockHistoryLink marked"><span className="guideMarker">3</span>Bấm tab Lịch sử thay đổi để xem nội dung cũ → mới</div>
      </div>
      <div className="guideCalloutList">
        <Callout number={1} text="Mở màn hiệu quả sau thay đổi" />
        <Callout number={2} text="Đồng bộ số liệu mới từ Google Ads" />
        <Callout number={3} text="Mở lịch sử để xem chi tiết đã thay" />
      </div>
      <figcaption>Ảnh 4 — Đồng bộ, đo lường và xem lịch sử</figcaption>
    </figure>
  );
}

export function UserGuidePage() {
  return (
    <div className="guidePage">
      <header className="guideHero">
        <div>
          <span className="eyebrow">Trung tâm trợ giúp</span>
          <h1>Hướng dẫn sử dụng GG Ads</h1>
          <p>Từ chọn tài khoản đến dùng AI, áp dụng thay đổi và kiểm tra hiệu quả trên Google Ads.</p>
        </div>
        <div className="guideHeroBadge"><KeyRound size={20} /><span>Mọi thay đổi quan trọng đều cần quyền phù hợp</span></div>
      </header>

      <div className="guideLayout">
        <aside className="guideToc" aria-label="Mục lục hướng dẫn">
          <strong>Nội dung</strong>
          {guideSections.map(({ id, label, icon: Icon }) => (
            <a href={`#${id}`} key={id}><Icon size={15} />{label}</a>
          ))}
        </aside>

        <div className="guideContent">
          <section className="guideSection" id="bat-dau">
            <div className="guideSectionTitle"><CheckCircle2 /><div><h2>Bắt đầu trong 4 bước</h2><p>Thiết lập đúng ngữ cảnh trước khi xem hoặc thay đổi quảng cáo.</p></div></div>
            <ol className="guideSteps">
              <Step number={1} title="Đăng nhập">Dùng email và mật khẩu được quản trị viên cấp.</Step>
              <Step number={2} title="Chọn tài khoản Google Ads">Chọn đúng ID khách hàng 10 chữ số ở thanh trên cùng.</Step>
              <Step number={3} title="Chọn khoảng ngày">Dùng 7, 14, 30 ngày hoặc chọn khoảng ngày tùy chỉnh.</Step>
              <Step number={4} title="Tải dữ liệu">Bấm Tải dữ liệu để lấy số liệu mới nhất cho màn hình đang xem.</Step>
            </ol>
            <AccountVisual />
            <div className="guideTip"><RefreshCw size={17} /><span>Ở màn Theo dõi thay đổi, hãy bấm <strong>Đồng bộ Google Ads</strong> trước khi đánh giá kết quả.</span></div>
          </section>

          <section className="guideSection" id="chien-dich">
            <div className="guideSectionTitle"><BarChart3 /><div><h2>Xem chiến dịch và nhóm quảng cáo</h2><p>Đi từ tổng quan xuống đúng tài nguyên cần tối ưu.</p></div></div>
            <div className="guideCards">
              <article><strong>Chiến dịch</strong><p>Xem lượt hiển thị, lượt nhấp, CTR, chi phí và Giá trị chuyển đổi / chi phí. Bấm một dòng để mở các nhóm quảng cáo.</p></article>
              <article><strong>Nhóm quảng cáo</strong><p>Dùng ô tìm kiếm theo tên hoặc ID. Bấm Mở tài nguyên để xem nội dung quảng cáo.</p></article>
              <article><strong>Tài nguyên</strong><p>Lọc theo hình ảnh, video hoặc nhãn LOW/GOOD/BEST. Nhãn LOW là nhóm nên được kiểm tra trước.</p></article>
            </div>
            <CampaignVisual />
          </section>

          <section className="guideSection" id="ai">
            <div className="guideSectionTitle"><Bot /><div><h2>Tạo và duyệt đề xuất AI</h2><p>AI hỗ trợ ra ý tưởng; người dùng vẫn kiểm soát việc áp dụng.</p></div></div>
            <ol className="guideSteps">
              <Step number={1} title="Mở một nhóm quảng cáo">Tải tài nguyên và kiểm tra các dòng hiệu quả thấp.</Step>
              <Step number={2} title="Tạo đề xuất">Bấm Tạo đề xuất AI hoặc Tạo đánh giá AI.</Step>
              <Step number={3} title="Đọc nội dung cũ và mới">Kiểm tra ngôn ngữ, ý nghĩa, giới hạn ký tự và chính sách quảng cáo.</Step>
              <Step number={4} title="Phê duyệt">Chỉ chọn những đề xuất bạn thực sự muốn dùng.</Step>
            </ol>
            <AiVisual />
            <div className="guideWarning"><CircleHelp size={17} /><span>AI không đảm bảo hiệu quả luôn tăng. Hãy đo lường đủ số ngày sau khi áp dụng.</span></div>
          </section>

          <section className="guideSection" id="thay-doi">
            <div className="guideSectionTitle"><Image /><div><h2>Thay văn bản, hình ảnh hoặc video</h2><p>Luôn xem trước và xác nhận trước khi cập nhật Google Ads.</p></div></div>
            <div className="guideCards">
              <article><strong>Văn bản</strong><p>Chọn đề xuất AI hoặc nhập tiêu đề/mô tả thủ công, tạo bản xem trước, kiểm tra rồi xác nhận áp dụng.</p></article>
              <article><strong>Hình ảnh</strong><p>Bấm Thay thế tại dòng hình ảnh, tải tệp mới lên và kiểm tra kích thước sau khi hệ thống tự điều chỉnh.</p></article>
              <article><strong>Video</strong><p>Chọn dòng video, nhập URL hoặc ID YouTube mới rồi xác nhận thay thế.</p></article>
            </div>
          </section>

          <section className="guideSection" id="do-luong">
            <div className="guideSectionTitle"><History /><div><h2>Kiểm tra thay đổi có hiệu quả không</h2><p>So sánh cùng số ngày trước và sau thay đổi.</p></div></div>
            <ol className="guideSteps">
              <Step number={1} title="Mở Theo dõi thay đổi">Chọn tab Hiệu quả sau thay đổi.</Step>
              <Step number={2} title="Chọn 7, 14 hoặc 30 ngày">Hệ thống chỉ kết luận khi đủ toàn bộ số ngày sau thay đổi.</Step>
              <Step number={3} title="Đồng bộ Google Ads">Kéo dữ liệu mới trực tiếp từ Google Ads trước khi xem kết quả.</Step>
              <Step number={4} title="Tìm và lọc">Tìm theo tên/ID, lọc thay đổi thủ công, AI đã duyệt hoặc AI tự động.</Step>
            </ol>
            <TrackingVisual />
            <div className="guideMetricGrid">
              <div><strong>CTR</strong><span>Tỷ lệ người nhấp sau khi thấy quảng cáo.</span></div>
              <div><strong>Tỷ lệ chuyển đổi</strong><span>Tỷ lệ lượt nhấp tạo ra chuyển đổi.</span></div>
              <div><strong>CPA</strong><span>Chi phí trung bình cho một chuyển đổi; thấp hơn thường tốt hơn.</span></div>
              <div><strong>Giá trị CĐ / chi phí</strong><span>Hiển thị theo %, giống chỉ số trong Google Ads.</span></div>
            </div>
            <p className="guideNote">Tab <strong>Lịch sử thay đổi</strong> cho phép tìm chiến dịch đã thay và bấm từng dòng để xem nội dung cũ → mới.</p>
          </section>

          <section className="guideSection" id="quyen">
            <div className="guideSectionTitle"><ShieldCheck /><div><h2>Quyền người dùng</h2><p>Mỗi vai trò chỉ nhìn thấy và thực hiện đúng phạm vi được cấp.</p></div></div>
            <div className="guidePermissionTable">
              <div><strong>Người xem</strong><span>Xem dữ liệu, không được áp dụng thay đổi.</span></div>
              <div><strong>Người chỉnh sửa</strong><span>Tạo, phê duyệt và áp dụng thay đổi trong tài khoản được cấp.</span></div>
              <div><strong>Quản trị viên</strong><span>Quản lý người dùng, tài khoản, chính sách và toàn bộ thao tác.</span></div>
            </div>
            <p className="guideNote"><Settings size={14} /> Quản trị viên cấp quyền tại <strong>Cài đặt → Quản lý quyền truy cập</strong>.</p>
          </section>

          <section className="guideSection" id="xu-ly-loi">
            <div className="guideSectionTitle"><CircleHelp /><div><h2>Xử lý lỗi thường gặp</h2><p>Kiểm tra theo thứ tự dưới đây trước khi liên hệ quản trị viên.</p></div></div>
            <details><summary>Không thấy chiến dịch hoặc nhóm quảng cáo</summary><p>Kiểm tra ID khách hàng, quyền tài khoản, khoảng ngày và bấm Tải dữ liệu.</p></details>
            <details><summary>Số liệu khác Google Ads</summary><p>Đảm bảo cùng ID khách hàng, cùng khoảng ngày và bấm Đồng bộ Google Ads. Chuyển đổi có thể được Google Ads ghi nhận bổ sung sau đó.</p></details>
            <details><summary>Không thể dùng AI hoặc áp dụng thay đổi</summary><p>Kiểm tra quyền chỉnh sửa, khóa API AI và trạng thái kết nối trong Cài đặt.</p></details>
            <details><summary>Thay đổi vẫn đang chờ dữ liệu</summary><p>Hệ thống cần đủ toàn bộ 7, 14 hoặc 30 ngày sau thay đổi mới kết luận tăng/giảm.</p></details>
          </section>

          <div className="guideSearchHint"><Search size={16} /><span>Mẹo: dùng <strong>Ctrl + F</strong> để tìm nhanh nội dung trong trang hướng dẫn.</span></div>
        </div>
      </div>
    </div>
  );
}
