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
    { label: 'Select ad group', done: hasAdGroup, icon: MousePointerClick },
    { label: 'Review assets', done: hasAssets, icon: Check },
    { label: 'Review AI ideas', done: hasSuggestions, icon: Sparkles },
    { label: 'Apply approved changes', done: approvedCount > 0, icon: Upload },
  ];
  const activeIndex = steps.findIndex((step) => !step.done);

  return (
    <section className="workflowBar" aria-label="Asset optimization workflow">
      <div className="workflowTitle">
        <strong>Manual approval workflow</strong>
        <span>{approvedCount > 0 ? `${approvedCount} approved` : 'Nothing changes without your approval'}</span>
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
