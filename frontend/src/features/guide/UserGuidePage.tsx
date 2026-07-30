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
} from 'lucide-react';

const guideSections = [
  ['bat-dau', 'Bắt đầu'],
  ['chien-dich', 'Xem chiến dịch'],
  ['ai', 'Dùng AI'],
  ['automation', 'Tự động hóa'],
  ['thay-doi', 'Thay tài nguyên'],
  ['do-luong', 'Đo lường'],
  ['quyen', 'Phân quyền'],
  ['xu-ly-loi', 'Xử lý lỗi'],
] as const;

function Step({ number, title, children }: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="guideStep">
      <span>{number}</span>
      <div><strong>{title}</strong><p>{children}</p></div>
    </li>
  );
}

function Marker({ number, children }: { number: number; children: React.ReactNode }) {
  return <div className="guideCallout"><span>{number}</span><strong>{children}</strong></div>;
}

function AccountPicture() {
  return (
    <figure className="guideVisual">
      <div className="guideMockTopbar">
        <div className="guideMockLogo">GG Ads</div>
        <div className="guideMockControl marked"><span className="guideMarker">1</span>Tài khoản Google Ads</div>
        <div className="guideMockControl marked"><span className="guideMarker">2</span>14 ngày</div>
        <button className="guideMockPrimary marked" type="button"><span className="guideMarker">3</span>Tải dữ liệu</button>
      </div>
      <div className="guideCalloutList">
        <Marker number={1}>Chọn đúng tài khoản cần làm việc</Marker>
        <Marker number={2}>Chọn cùng khoảng ngày với Google Ads</Marker>
        <Marker number={3}>Tải dữ liệu mới nhất</Marker>
      </div>
      <figcaption>Ảnh 1 — Chọn tài khoản và tải dữ liệu</figcaption>
    </figure>
  );
}

function CampaignPicture() {
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
            <div className="guideMockTableHead"><span>Chiến dịch</span><span>Trạng thái</span><span>CTR</span></div>
            <div className="guideMockTableRow marked"><span className="guideMarker">3</span><strong>Chiến dịch AC</strong><span>Đang bật</span><span>6,87%</span></div>
          </div>
        </div>
      </div>
      <div className="guideCalloutList">
        <Marker number={1}>Mở danh sách chiến dịch</Marker>
        <Marker number={2}>Tìm theo tên hoặc ID, ví dụ “AC”</Marker>
        <Marker number={3}>Nhấn vào dòng để xem nhóm quảng cáo</Marker>
      </div>
      <figcaption>Hình 2 — Tìm kiếm và mở chiến dịch</figcaption>
    </figure>
  );
}

function AutomationPicture() {
  return (
    <figure className="guideVisual">
      <div className="guideMockPanel">
        <div className="guideMockPanelHead">
          <div><strong>AI định kỳ</strong><span>Chạy mỗi 14 ngày</span></div>
          <button className="marked" type="button"><span className="guideMarker">1</span>Chạy ngay</button>
        </div>
        <div className="guideMockSuggestion">
          <div><small>Chế độ</small><strong>TỰ ĐỘNG</strong></div>
          <div><small>Lần chạy tiếp theo</small><strong>12/08/2026</strong></div>
        </div>
        <div className="guideMockFooter">
          <span className="marked"><span className="guideMarker">2</span>Đang bật</span>
          <button className="marked" type="button"><span className="guideMarker">3</span>Tắt</button>
        </div>
      </div>
      <div className="guideCalloutList">
        <Marker number={1}>Bắt đầu Automation và chạy một lần ngay</Marker>
        <Marker number={2}>Kiểm tra trạng thái và lịch chạy tiếp theo</Marker>
        <Marker number={3}>Tạm dừng khi muốn tự thay tài nguyên</Marker>
      </div>
      <figcaption><span>Ảnh 3 — Tạo và phê duyệt đề xuất AI</span><br />Minh họa bật hoặc tạm dừng AI định kỳ</figcaption>
    </figure>
  );
}

function TrackingPicture() {
  return (
    <figure className="guideVisual">
      <div className="guideMockTracking">
        <div className="guideMockTabs">
          <strong className="marked"><span className="guideMarker">1</span>Hiệu quả sau thay đổi</strong>
          <span>Lịch sử thay đổi</span>
        </div>
        <div className="guideMockTrackingActions">
          <div className="guideMockSearch marked"><span className="guideMarker">2</span>Tìm chiến dịch đã thay</div>
          <button className="marked" type="button"><span className="guideMarker">3</span>Đồng bộ Google Ads</button>
        </div>
        <div className="guideMockResults">
          <div><span>Hiệu quả tăng</span><strong>4</strong></div>
          <div><span>Hiệu quả giảm</span><strong>1</strong></div>
          <div><span>Chờ dữ liệu</span><strong>8</strong></div>
        </div>
      </div>
      <div className="guideCalloutList">
        <Marker number={1}>Chọn màn hiệu quả hoặc lịch sử</Marker>
        <Marker number={2}>Tìm toàn bộ lịch sử theo tên hoặc ID</Marker>
        <Marker number={3}>Lấy số liệu mới từ Google Ads trước khi đánh giá</Marker>
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
          <p>Hướng dẫn từng bước từ đăng nhập, dùng AI đến kiểm tra hiệu quả trên Google Ads.</p>
        </div>
        <div className="guideHeroBadge"><KeyRound size={20} /><span>Thao tác thay đổi cần quyền phù hợp</span></div>
      </header>

      <div className="guideLayout">
        <aside className="guideToc" aria-label="Mục lục hướng dẫn">
          <strong>Nội dung</strong>
          {guideSections.map(([id, label]) => <a href={`#${id}`} key={id}>{label}</a>)}
        </aside>

        <div className="guideContent">
          <section className="guideSection" id="bat-dau">
            <div className="guideSectionTitle"><CheckCircle2 /><div><h2>Bắt đầu trong 4 bước</h2><p>Thiết lập đúng tài khoản trước khi xem hoặc thay đổi quảng cáo.</p></div></div>
            <ol className="guideSteps">
              <Step number={1} title="Đăng nhập">Dùng tài khoản được quản trị viên cấp.</Step>
              <Step number={2} title="Chọn tài khoản Google Ads">Chọn đúng ID khách hàng 10 chữ số trên thanh đầu trang.</Step>
              <Step number={3} title="Chọn khoảng ngày">Chọn 7, 14, 30 ngày hoặc khoảng tùy chỉnh giống Google Ads.</Step>
              <Step number={4} title="Tải dữ liệu">Nhấn Tải dữ liệu để làm mới màn hình hiện tại.</Step>
            </ol>
            <AccountPicture />
          </section>

          <section className="guideSection" id="chien-dich">
            <div className="guideSectionTitle"><BarChart3 /><div><h2>Tìm và xem chiến dịch</h2><p>Tìm theo tên hoặc ID rồi đi từ chiến dịch xuống tài nguyên.</p></div></div>
            <CampaignPicture />
            <p className="guideNote">Chiến dịch hoặc nhóm quảng cáo đã tạm dừng vẫn được hiển thị với trạng thái lấy từ Google Ads.</p>
          </section>

          <section className="guideSection" id="ai">
            <div className="guideSectionTitle"><Bot /><div><h2>Dùng đề xuất AI</h2><p>AI hỗ trợ viết nội dung; người dùng vẫn kiểm soát việc áp dụng.</p></div></div>
            <ol className="guideSteps">
              <Step number={1} title="Mở tài nguyên">Chọn chiến dịch, nhóm quảng cáo rồi mở màn Tài nguyên.</Step>
              <Step number={2} title="Tạo đề xuất">Nhấn Tạo đề xuất AI tại phần nội dung hiệu quả thấp.</Step>
              <Step number={3} title="Kiểm tra">So sánh nội dung hiện tại và đề xuất, kiểm tra ý nghĩa và chính sách.</Step>
              <Step number={4} title="Xem trước và áp dụng">Chọn đề xuất, xác nhận đã kiểm tra rồi mới gửi sang Google Ads.</Step>
            </ol>
            <div className="guideWarning"><CircleHelp size={17} /><span>AI không đảm bảo mọi chiến dịch đều tăng. Chỉ kết luận sau khi đã đủ dữ liệu.</span></div>
          </section>

          <section className="guideSection" id="automation">
            <div className="guideSectionTitle"><Settings /><div><h2>AI định kỳ và chế độ thủ công</h2><p>Bạn có thể dừng Automation bất cứ lúc nào để tự thay tài nguyên.</p></div></div>
            <AutomationPicture />
            <ol className="guideSteps">
              <Step number={1} title="Bật tự động">Vào Cài đặt, chọn chu kỳ và nhấn Chạy ngay.</Step>
              <Step number={2} title="Theo dõi">Xem lần chạy gần nhất, lần tiếp theo và số thay đổi đã áp dụng.</Step>
              <Step number={3} title="Tạm dừng">Nhấn Tắt; hệ thống hoàn tất thao tác đang gửi nhưng không tạo thay đổi mới.</Step>
              <Step number={4} title="Tự thay">Sau khi dừng, bạn vẫn thay văn bản, ảnh hoặc video thủ công bình thường.</Step>
            </ol>
          </section>

          <section className="guideSection" id="thay-doi">
            <div className="guideSectionTitle"><Image /><div><h2>Thay văn bản, hình ảnh và video</h2><p>Luôn xem trước trước khi cập nhật Google Ads.</p></div></div>
            <div className="guideCards">
              <article><strong>Văn bản</strong><p>Chọn nội dung mới, tạo bản xem trước, kiểm tra rồi xác nhận áp dụng.</p></article>
              <article><strong>Hình ảnh</strong><p>Chọn ảnh cũ, tải ảnh mới tối đa 10 MB và kiểm tra hình xem trước.</p></article>
              <article><strong>Video</strong><p>Chọn video cũ, nhập URL hoặc ID YouTube mới rồi xác nhận.</p></article>
            </div>
          </section>

          <section className="guideSection" id="do-luong">
            <div className="guideSectionTitle"><History /><div><h2>Kiểm tra thay đổi có hiệu quả không</h2><p>So sánh cùng số ngày trước và sau, không tính ngày thay đổi.</p></div></div>
            <TrackingPicture />
            <div className="guideMetricGrid">
              <div><strong>CTR</strong><span>Tỷ lệ nhấp, hiển thị theo %.</span></div>
              <div><strong>Tỷ lệ chuyển đổi</strong><span>Tỷ lệ lượt nhấp tạo chuyển đổi.</span></div>
              <div><strong>CPA</strong><span>Chi phí trung bình cho một chuyển đổi.</span></div>
              <div><strong>Giá trị chuyển đổi/chi phí</strong><span>Hiển thị theo %, giống cột trong Google Ads.</span></div>
            </div>
            <div className="guideTip"><RefreshCw size={17} /><span>Nhấn <strong>Đồng bộ Google Ads</strong> trước khi đánh giá kết quả mới nhất.</span></div>
          </section>

          <section className="guideSection" id="quyen">
            <div className="guideSectionTitle"><ShieldCheck /><div><h2>Phân quyền</h2><p>Mỗi người chỉ truy cập tài khoản và chức năng được cấp.</p></div></div>
            <div className="guidePermissionTable">
              <div><strong>Người xem</strong><span>Xem số liệu, lịch sử và hiệu quả.</span></div>
              <div><strong>Người chỉnh sửa</strong><span>Duyệt, áp dụng và quản lý Automation trong tài khoản được cấp.</span></div>
              <div><strong>Quản trị viên</strong><span>Quản lý người dùng, quyền tài khoản và toàn bộ cài đặt.</span></div>
            </div>
          </section>

          <section className="guideSection" id="xu-ly-loi">
            <div className="guideSectionTitle"><CircleHelp /><div><h2>Xử lý lỗi thường gặp</h2><p>Kiểm tra theo thứ tự trước khi thử lại.</p></div></div>
            <details><summary>Không thấy chiến dịch vừa tạm dừng</summary><p>Kiểm tra đúng tài khoản và nhấn Tải dữ liệu hoặc Đồng bộ Google Ads.</p></details>
            <details><summary>Số liệu khác Google Ads</summary><p>Chọn cùng ID, khoảng ngày và múi giờ; sau đó đồng bộ lại dữ liệu.</p></details>
            <details><summary>Yêu cầu báo bị gián đoạn</summary><p>Đồng bộ Google Ads và kiểm tra Lịch sử thay đổi. Không áp dụng lại trước khi chắc chắn thay đổi cũ chưa tồn tại.</p></details>
            <details><summary>Chưa có kết luận tăng hoặc giảm</summary><p>Hệ thống cần đủ toàn bộ 7, 14 hoặc 30 ngày sau thay đổi mới đưa ra kết luận.</p></details>
          </section>

          <div className="guideSearchHint"><Search size={16} /><span>Dùng <strong>Ctrl + F</strong> để tìm nhanh nội dung trong trang.</span></div>
        </div>
      </div>
    </div>
  );
}
