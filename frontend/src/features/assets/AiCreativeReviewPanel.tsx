import { FileText, Image, RefreshCw, Sparkles, Video } from 'lucide-react';
import { formatNumber, formatPercent } from '../../utils/format';
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
  const linkedRecommendations = aiRecommendations.filter((item) => item.asset);

  return (
    <section className="creativeReview">
      <div className="editorHeader">
        <div>
          <h2>Đánh giá nội dung bằng AI</h2>
          <p>
            {aiReview
              ? `${linkedRecommendations.length} tài nguyên có đề xuất từ mô hình ${aiReview.model}`
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

      {linkedRecommendations.length > 0 ? (
        <div className="creativeGrid">
          {linkedRecommendations.map((item, index) => {
            const asset = item.asset!;
            const previewUrl = asset.previewUrl ?? '';
            const currentContent = asset.text || asset.title || `Tài nguyên ${asset.id}`;
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
                    <span className="textType">{asset.fieldType || item.mediaType}</span>
                    <span>Nhãn {asset.performanceLabel || 'UNKNOWN'}</span>
                    <span>Ưu tiên {item.priority}</span>
                  </div>
                  <div className="currentAssetBlock">
                    <span className="creativeSectionLabel">Nội dung hiện tại</span>
                    <strong>{currentContent}</strong>
                    <div className="currentAssetMetrics">
                      <span>{formatNumber(asset.impressions)} lượt hiển thị</span>
                      <span>{formatNumber(asset.clicks)} lượt nhấp</span>
                      <span>CTR {formatPercent(asset.ctr)}</span>
                      <span>Độ tin cậy {item.confidence}</span>
                    </div>
                  </div>
                  <span className="creativeSectionLabel">Đề xuất thay thế</span>
                  <div className="ideaList">
                    {item.replacementIdeas.map((idea, ideaIndex) => (
                      <div key={idea} className="ideaOption">
                        <b>{ideaIndex + 1}</b>
                        <span>{idea}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : aiReview && aiRecommendations.length > 0 ? (
        <div className="inlineError">AI không trả về đề xuất nào liên kết được với tài nguyên hiện tại. Hãy tạo lại đánh giá.</div>
      ) : assetData && !aiReviewLoading && !aiReview ? (
        <div className="emptySuggestions">Bấm Tạo đánh giá AI để phân tích các tài nguyên này.</div>
      ) : null}
    </section>
  );
}
