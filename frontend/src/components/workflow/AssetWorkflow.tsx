import { Check, MousePointerClick, Sparkles, Upload } from 'lucide-react';

type AssetWorkflowProps = {
  hasAdGroup: boolean;
  hasAssets: boolean;
  hasSuggestions: boolean;
  approvedCount: number;
};

export function AssetWorkflow({
  hasAdGroup,
  hasAssets,
  hasSuggestions,
  approvedCount,
}: AssetWorkflowProps) {
  const steps = [
    { label: 'Chọn nhóm quảng cáo', done: hasAdGroup, icon: MousePointerClick },
    { label: 'Kiểm tra tài nguyên', done: hasAssets, icon: Check },
    { label: 'Kiểm tra đề xuất AI', done: hasSuggestions, icon: Sparkles },
    { label: 'Áp dụng thay đổi đã duyệt', done: approvedCount > 0, icon: Upload },
  ];
  const activeIndex = steps.findIndex((step) => !step.done);

  return (
    <section className="workflowBar" aria-label="Quy trình tối ưu tài nguyên">
      <div className="workflowTitle">
        <strong>Quy trình phê duyệt thủ công</strong>
        <span>{approvedCount > 0 ? `Đã duyệt ${approvedCount} đề xuất` : 'Không có thay đổi nào được áp dụng khi chưa có sự phê duyệt của bạn'}</span>
      </div>
      <ol>
        {steps.map((step, index) => {
          const Icon = step.icon;
          const active = index === (activeIndex === -1 ? steps.length - 1 : activeIndex);

          return (
            <li key={step.label} className={`${step.done ? 'done' : ''} ${active ? 'active' : ''}`}>
              <span className="workflowIcon">
                {step.done ? <Check size={14} /> : <Icon size={14} />}
              </span>
              <span>{step.label}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
