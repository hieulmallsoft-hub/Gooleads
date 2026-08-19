import { useState } from 'react';
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Database,
  Eye,
  HelpCircle,
  Layers,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';
import type { ViewMode } from '../../types/googleAds';
import type { OperationsSection } from '../OperationsPanel';

type QuickWorkflowBannerProps = {
  viewMode: ViewMode;
  operationsSection: OperationsSection | null;
  onOpenCampaigns: () => void;
  onOpenLowAssets: () => void;
  onOpenAiReview: () => void;
  onOpenImpact: () => void;
  onOpenGuide: () => void;
};

export function QuickWorkflowBanner({
  viewMode,
  operationsSection,
  onOpenCampaigns,
  onOpenLowAssets,
  onOpenAiReview,
  onOpenImpact,
  onOpenGuide,
}: QuickWorkflowBannerProps) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem('ggads_workflow_banner_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem('ggads_workflow_banner_collapsed', String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  // Determine active step based on current view
  let activeStep = 1;
  if (operationsSection === 'impact') {
    activeStep = 4;
  } else if (operationsSection === 'overview' || operationsSection === 'recommendations' || operationsSection === 'automation') {
    activeStep = 3;
  } else if (viewMode === 'assets') {
    activeStep = 2;
  } else {
    activeStep = 1;
  }

  const steps = [
    {
      step: 1,
      title: 'Chọn tài khoản & Chu kỳ',
      subtitle: 'Xem chỉ số sức khỏe chiến dịch',
      badge: 'Bắt đầu',
      icon: Database,
      actionText: 'Xem chiến dịch',
      color: 'blue',
      onClick: onOpenCampaigns,
    },
    {
      step: 2,
      title: 'Quét Asset hiệu quả thấp',
      subtitle: 'Phát hiện nhãn LOW cần thay thế',
      badge: 'Phân tích',
      icon: Eye,
      actionText: 'Xem tài nguyên',
      color: 'amber',
      onClick: onOpenLowAssets,
    },
    {
      step: 3,
      title: 'Tối ưu tự động bằng AI',
      subtitle: 'Tạo gợi ý tiêu đề, mô tả & ảnh mới',
      badge: 'AI Magic',
      icon: Bot,
      actionText: 'Mở AI Studio',
      color: 'indigo',
      onClick: onOpenAiReview,
    },
    {
      step: 4,
      title: 'Duyệt & Đo lường tác động',
      subtitle: 'Theo dõi CTR, ROAS tăng trưởng',
      badge: 'Đo lường',
      icon: TrendingUp,
      actionText: 'Xem tác động',
      color: 'emerald',
      onClick: onOpenImpact,
    },
  ];

  return (
    <div className={`workflowGuideBanner ${collapsed ? 'isCollapsed' : ''}`} aria-label="Quy trình tối ưu">
      <div className="workflowHeader">
        <div className="workflowTitleBlock">
          <div className="workflowHeroIcon">
            <Zap size={20} />
          </div>
          <div>
            <div className="workflowTitleRow">
              <h3>Quy trình 4 bước tối ưu quảng cáo Google Ads</h3>
              <span className="workflowBadge">
                <Sparkles size={13} />
                <span>AI Automated</span>
              </span>
            </div>
            <p>Hệ thống tự động phân tích dữ liệu hiệu suất, đề xuất tối ưu sáng tạo bằng AI và đo lường tác động ROI.</p>
          </div>
        </div>

        <div className="workflowControls">
          <button
            type="button"
            className="workflowGuideBtn"
            onClick={onOpenGuide}
            title="Mở sổ tay hướng dẫn chi tiết"
          >
            <HelpCircle size={15} />
            <span>Sổ tay hướng dẫn</span>
          </button>
          <button
            type="button"
            className="workflowCollapseBtn"
            onClick={toggleCollapse}
            aria-label={collapsed ? 'Mở rộng hướng dẫn' : 'Thu gọn hướng dẫn'}
          >
            {collapsed ? (
              <>
                <span>Hiện quy trình</span>
                <ChevronDown size={15} />
              </>
            ) : (
              <>
                <span>Thu gọn</span>
                <ChevronUp size={15} />
              </>
            )}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="workflowStepsGrid">
          {steps.map((item) => {
            const Icon = item.icon;
            const isCurrent = activeStep === item.step;
            const isDone = activeStep > item.step;

            return (
              <button
                type="button"
                key={item.step}
                className={`workflowStepCard step-${item.color} ${isCurrent ? 'isCurrent' : ''} ${isDone ? 'isDone' : ''}`}
                onClick={item.onClick}
              >
                <div className="workflowStepTop">
                  <div className="workflowStepIconBox">
                    {isDone ? <CheckCircle2 size={16} className="textDone" /> : <Icon size={16} />}
                  </div>
                  <div className="workflowStepMeta">
                    <span className="workflowStepNumber">Bước {item.step}</span>
                    <span className={`workflowStepTag tag-${item.color}`}>{item.badge}</span>
                  </div>
                </div>

                <div className="workflowStepInfo">
                  <strong>{item.title}</strong>
                  <span>{item.subtitle}</span>
                </div>

                <div className="workflowStepAction">
                  <span>{item.actionText}</span>
                  <ArrowRight size={13} className="actionArrow" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
