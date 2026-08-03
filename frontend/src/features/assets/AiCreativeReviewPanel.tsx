import { FileText, Image, RefreshCw, Sparkles, Video } from 'lucide-react';
import type {
  AiCreativeRecommendation,
  AiReviewResponse,
  AssetResponse,
} from '../../types/googleAds';

type AiCreativeReviewPanelProps = {
  assetData: AssetResponse | null;
  assetLoading: boolean;
  aiReview: AiReviewResponse | null;
  aiRecommendations: AiCreativeRecommendation[];
  aiReviewLoading: boolean;
  aiReviewError: string;
  autoAiEnabled: boolean;
  canEdit: boolean;
  approvedCreativeSuggestionIds: string[];
  decisionLoadingIds: string[];
  onAutoAiChange: (enabled: boolean) => void;
  onGenerate: () => void;
  onToggleApproval: (item: AiCreativeRecommendation) => void;
};

export function AiCreativeReviewPanel({
  assetData,
  assetLoading,
  aiReview,
  aiRecommendations,
  aiReviewLoading,
  aiReviewError,
  autoAiEnabled,
  canEdit,
  approvedCreativeSuggestionIds,
  decisionLoadingIds,
  onAutoAiChange,
  onGenerate,
  onToggleApproval,
}: AiCreativeReviewPanelProps) {
  return (
    <section className="creativeReview">
      <div className="editorHeader">
        <div>
          <h2>Đánh giá nội dung bằng AI</h2>
          <p>
            {aiReview
              ? `${aiRecommendations.length} đề xuất từ mô hình ${aiReview.model}`
              : assetData
                ? autoAiEnabled
                  ? 'AI tự động đang bật cho tài khoản này; bấm Tạo đánh giá AI để làm mới'
                  : 'Chế độ thủ công; bấm Tạo đánh giá AI khi bạn muốn phân tích'
                : 'Hãy tải tài nguyên trước'}
          </p>
        </div>
        <div className="editorTools">
          <span className="pill">Phê duyệt thủ công</span>
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
            className="primaryButton editorAction"
            type="button"
            onClick={onGenerate}
            disabled={!canEdit || !assetData || assetLoading || aiReviewLoading}
          >
            {aiReviewLoading ? (
              <RefreshCw size={15} className="spin" />
            ) : (
              <Sparkles size={15} />
            )}
            {aiReviewLoading ? 'Đang hỏi AI...' : 'Tạo đánh giá AI'}
          </button>
        </div>
      </div>

      {aiReviewError ? <div className="inlineError">{aiReviewError}</div> : null}

      {aiRecommendations.length > 0 ? (
        <div className="creativeGrid">
          {aiRecommendations.map((item, index) => {
            const previewUrl = item.asset?.previewUrl ?? '';
            const isApproved = approvedCreativeSuggestionIds.includes(item.suggestionId);
            const decisionLoading = decisionLoadingIds.includes(item.suggestionId);
            const MediaIcon =
              item.mediaType === 'Video'
                ? Video
                : item.mediaType === 'Image'
                  ? Image
                  : FileText;

            return (
              <article className="creativeCard" key={`${item.assetKey}-${index}`}>
                <div className="assetPreview">
                  {previewUrl ? (
                    <img src={previewUrl} alt="" loading="lazy" />
                  ) : (
                    <span className="assetPreviewIcon">
                      <MediaIcon size={22} />
                    </span>
                  )}
                  <span className="rankBadge">#{index + 1}</span>
                </div>
                <div className="creativeBody">
                  <div className="creativeMeta">
                    <label className="suggestionSelect">
                      <input
                        type="checkbox"
                        checked={isApproved}
                        disabled={!canEdit || decisionLoading}
                        onChange={() => onToggleApproval(item)}
                      />
                      <span>{decisionLoading ? 'Đang lưu...' : 'Phê duyệt đề xuất'}</span>
                    </label>
                    <span className="textType">{item.mediaType}</span>
                    <span>{item.priority}</span>
                    <span>Độ tin cậy {item.confidence}</span>
                  </div>
                  <strong>{item.title}</strong>
                  <div className="ideaList">
                    {item.replacementIdeas.map((idea) => (
                      <span key={idea}>{idea}</span>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : assetData && !aiReviewLoading && !aiReview ? (
        <div className="emptySuggestions">Bấm Tạo đánh giá AI để phân tích các tài nguyên này.</div>
      ) : null}
    </section>
  );
}
