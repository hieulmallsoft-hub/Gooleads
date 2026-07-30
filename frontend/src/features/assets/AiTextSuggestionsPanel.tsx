import { RefreshCw, Sparkles } from 'lucide-react';
import {
  DESCRIPTION_MAX_LENGTH,
  HEADLINE_MAX_LENGTH,
} from '../../config/googleAds';
import { formatNumber } from '../../utils/format';
import type {
  AiTextSuggestionsResponse,
  AssetResponse,
  LowTextSuggestion,
  TextChangeRequest,
} from '../../types/googleAds';

type AiTextSuggestionsPanelProps = {
  assetData: AssetResponse | null;
  aiTextSuggestions: AiTextSuggestionsResponse | null;
  lowTextAssetCount: number;
  totalLowTextImpressions: number;
  lowTextCandidateCount: number;
  lowTextSuggestions: LowTextSuggestion[];
  selectedLowTextSuggestions: LowTextSuggestion[];
  selectedTextSuggestionSet: ReadonlySet<string>;
  decisionLoadingIds: string[];
  replacementHeadline: string;
  replacementDescription: string;
  textChangeRequest: TextChangeRequest | null;
  replaceConfirmed: boolean;
  autoAiEnabled: boolean;
  canEdit: boolean;
  aiTextLoading: boolean;
  aiTextDisabled: boolean;
  replaceLoading: boolean;
  createTextChangeDisabled: boolean;
  applyTextChangeDisabled: boolean;
  replaceError: string;
  aiTextError: string;
  replaceStatus: string;
  onAutoAiChange: (enabled: boolean) => void;
  onGenerate: () => void;
  onToggleApproval: (asset: LowTextSuggestion) => void;
  onToggleAllApprovals: () => void;
  onHeadlineChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onReplaceConfirmedChange: (confirmed: boolean) => void;
  onCreatePreview: () => void;
  onApplyPreview: () => void;
};

const statusLabel: Record<string, string> = {
  PENDING: 'Chờ áp dụng',
  APPLYING: 'Đang áp dụng',
  APPLIED: 'Đã áp dụng',
  PARTIAL: 'Áp dụng một phần',
  FAILED: 'Thất bại',
  SKIPPED: 'Đã bỏ qua',
};

const fieldTypeLabel: Record<string, string> = {
  HEADLINE: 'Tiêu đề',
  DESCRIPTION: 'Mô tả',
  LONG_HEADLINE: 'Tiêu đề dài',
};

export function AiTextSuggestionsPanel({
  assetData,
  aiTextSuggestions,
  lowTextAssetCount,
  totalLowTextImpressions,
  lowTextCandidateCount,
  lowTextSuggestions,
  selectedLowTextSuggestions,
  selectedTextSuggestionSet,
  decisionLoadingIds,
  replacementHeadline,
  replacementDescription,
  textChangeRequest,
  replaceConfirmed,
  autoAiEnabled,
  canEdit,
  aiTextLoading,
  aiTextDisabled,
  replaceLoading,
  createTextChangeDisabled,
  applyTextChangeDisabled,
  replaceError,
  aiTextError,
  replaceStatus,
  onAutoAiChange,
  onGenerate,
  onToggleApproval,
  onToggleAllApprovals,
  onHeadlineChange,
  onDescriptionChange,
  onReplaceConfirmedChange,
  onCreatePreview,
  onApplyPreview,
}: AiTextSuggestionsPanelProps) {
  const isPreviewReady = textChangeRequest?.status === 'PENDING';

  return (
    <section className="assetEditor">
      <div className="editorHeader">
        <div>
          <h2>Đề xuất nội dung bằng AI</h2>
          <p>
            {assetData
              ? `${lowTextAssetCount} nội dung hiệu quả thấp · ${formatNumber(totalLowTextImpressions)} lượt hiển thị`
              : 'Hãy tải tài nguyên trước'}
          </p>
        </div>
        <div className="editorTools">
          <span className="pill">Phê duyệt thủ công</span>
          <span className="pill">
            {aiTextSuggestions
              ? `${aiTextSuggestions.source.toUpperCase()} ${aiTextSuggestions.model}`
                : 'Nhà cung cấp AI'}
          </span>
          <label className={`autoAiToggle${autoAiEnabled ? ' active' : ''}`}>
            <input
              type="checkbox"
              checked={autoAiEnabled}
              disabled={!canEdit}
              onChange={(event) => onAutoAiChange(event.target.checked)}
            />
            <span>AI tự động</span>
          </label>
          <button
            className="tableActionButton aiTextButton"
            type="button"
            onClick={onGenerate}
            disabled={!canEdit || aiTextDisabled}
          >
            {aiTextLoading ? (
              <RefreshCw size={14} className="spin" />
            ) : (
              <Sparkles size={14} />
            )}
            {aiTextLoading ? 'Đang hỏi AI...' : 'Tạo đề xuất AI'}
          </button>
        </div>
      </div>

      {lowTextSuggestions.length > 0 ? (
        <div className="suggestionList">
          <div className="approvalToolbar">
            <span>
              Đã duyệt {selectedLowTextSuggestions.length}/{lowTextSuggestions.length} đề xuất
            </span>
            <button
              className="tableActionButton"
              type="button"
              onClick={onToggleAllApprovals}
              disabled={!canEdit || decisionLoadingIds.length > 0}
            >
              {selectedLowTextSuggestions.length === lowTextSuggestions.length
                ? 'Bỏ chọn tất cả'
                : 'Chọn tất cả'}
            </button>
          </div>
          {lowTextSuggestions.map((asset) => {
            const isSelected = selectedTextSuggestionSet.has(asset.key);

            return (
              <article className={`suggestionRow${isSelected ? ' selected' : ''}`} key={asset.key}>
                <div className="suggestionMeta">
                  <label className="suggestionSelect">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleApproval(asset)}
                      disabled={!canEdit || decisionLoadingIds.includes(asset.suggestionId)}
                    />
                    <span>Phê duyệt</span>
                  </label>
                  <span className="textType">{fieldTypeLabel[asset.fieldType] ?? asset.fieldType}</span>
                  <span>{formatNumber(asset.impressions)} lượt hiển thị</span>
                  <span>{asset.priority}</span>
                  <span>Độ tin cậy {asset.confidence}</span>
                </div>
                <div className="suggestionCopy">
                  <div>
                    <span>Hiện tại</span>
                    <strong>{asset.text}</strong>
                  </div>
                  <div>
                    <span>Đề xuất AI</span>
                    <strong>{asset.suggestion}</strong>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : assetData && lowTextCandidateCount > 0 ? (
        <div className="emptySuggestions">
          Bấm Tạo đề xuất AI để phân tích các nội dung hiệu quả thấp này.
        </div>
      ) : assetData ? (
        <div className="emptySuggestions">Không tìm thấy tiêu đề/mô tả có hiệu quả THẤP.</div>
      ) : null}

      <div className="editorGrid">
        <label className="editorField">
          <span>Tiêu đề nhập thủ công {replacementHeadline.length}/{HEADLINE_MAX_LENGTH}</span>
          <input
            value={replacementHeadline}
            maxLength={HEADLINE_MAX_LENGTH}
            disabled={!canEdit}
            onChange={(event) => onHeadlineChange(event.target.value)}
            placeholder="Tiêu đề không bắt buộc"
          />
        </label>
        <label className="editorField">
          <span>Mô tả nhập thủ công {replacementDescription.length}/{DESCRIPTION_MAX_LENGTH}</span>
          <input
            value={replacementDescription}
            maxLength={DESCRIPTION_MAX_LENGTH}
            disabled={!canEdit}
            onChange={(event) => onDescriptionChange(event.target.value)}
            placeholder="Mô tả không bắt buộc"
          />
        </label>
      </div>

      {textChangeRequest ? (
        <div className={`changePreview status-${textChangeRequest.status.toLowerCase()}`}>
          <div className="changePreviewHeader">
            <div>
              <strong>Xem trước yêu cầu thay đổi</strong>
              <span>{textChangeRequest.id}</span>
            </div>
            <span className="pill">{statusLabel[textChangeRequest.status] ?? textChangeRequest.status}</span>
          </div>
          <div className="changePreviewList">
            {textChangeRequest.items.map((item, index) => {
              const changes = item.beforePayload.changes ?? [];
              return (
                <article className="changePreviewItem" key={item.id}>
                  <div className="changePreviewMeta">
                    <span>Quảng cáo #{index + 1}</span>
                    <span>
                      {item.replacementCount} nội dung thay thế
                    </span>
                    <span>{statusLabel[item.status] ?? item.status}</span>
                  </div>
                  <div className="changePreviewCopy">
                    {changes.map((change, changeIndex) => (
                      <div key={`${item.id}-${change.fieldType}-${changeIndex}`}>
                        <span>{fieldTypeLabel[change.fieldType] ?? change.fieldType}</span>
                        <strong>{change.oldText}</strong>
                        <strong>{change.newText}</strong>
                      </div>
                    ))}
                  </div>
                  {item.errorMessage ? <p>{item.errorMessage}</p> : null}
                </article>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="editorFooter">
        {isPreviewReady ? (
          <label className="confirmRow">
            <input
              type="checkbox"
              checked={replaceConfirmed}
              disabled={!canEdit}
              onChange={(event) => onReplaceConfirmedChange(event.target.checked)}
            />
            <span>Tôi đã xem nội dung này và muốn áp dụng lên Google Ads</span>
          </label>
        ) : (
          <span className="editorHint">Hãy tạo bản xem trước trước khi áp dụng lên Google Ads.</span>
        )}
        <button
          className="primaryButton editorAction"
          type="button"
          onClick={isPreviewReady ? onApplyPreview : onCreatePreview}
          disabled={!canEdit || (isPreviewReady ? applyTextChangeDisabled : createTextChangeDisabled)}
        >
          {replaceLoading ? (
            <RefreshCw size={15} className="spin" />
          ) : (
            <Sparkles size={15} />
          )}
          {replaceLoading
            ? isPreviewReady ? 'Đang áp dụng...' : 'Đang chuẩn bị...'
            : isPreviewReady ? 'Áp dụng lên Google Ads' : 'Tạo bản xem trước'}
        </button>
      </div>

      {replaceError ? <div className="inlineError">{replaceError}</div> : null}
      {aiTextError ? <div className="inlineError">{aiTextError}</div> : null}
      {replaceStatus ? <div className="inlineSuccess">{replaceStatus}</div> : null}
    </section>
  );
}
