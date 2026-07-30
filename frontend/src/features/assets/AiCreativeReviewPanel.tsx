import { FileText, Image, RefreshCw, Sparkles, Video } from 'lucide-react';
import { getMediaReplacementType } from '../../utils/assets';
import type {
  AiCreativeRecommendation,
  AiReviewResponse,
  Asset,
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
  onUseMediaIdea: (asset: Asset) => void;
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
  onUseMediaIdea,
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
            const reviewAsset = item.asset;
            const matchingMediaAsset =
              reviewAsset && assetData
                ? assetData.assets.find((asset) => {
                    const mediaType = getMediaReplacementType(asset);
                    const sameId = Boolean(
                      asset.id &&
                        reviewAsset.id &&
                        asset.id === reviewAsset.id,
                    );
                    const sameText = Boolean(
                      asset.text &&
                        reviewAsset.text &&
                        asset.text === reviewAsset.text,
                    );
                    const samePlacement =
                      asset.fieldType === reviewAsset.fieldType ||
                      asset.type === reviewAsset.type;

                    return Boolean(mediaType && (sameId || sameText) && samePlacement);
                  }) ?? null
                : null;
            const matchingMediaType = matchingMediaAsset
              ? getMediaReplacementType(matchingMediaAsset)
              : '';
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
                  {matchingMediaAsset && matchingMediaType ? (
                    <div className="creativeActions">
                      <button
                        className="tableActionButton inlineReplaceButton"
                        type="button"
                        onClick={() => onUseMediaIdea(matchingMediaAsset)}
                        disabled={!canEdit}
                        title="Chọn tài nguyên này để thay thế"
                      >
                        {matchingMediaType === 'VIDEO' ? (
                          <Video size={13} />
                        ) : (
                          <Image size={13} />
                        )}
                        Dùng trong phần Thay thế
                      </button>
                    </div>
                  ) : null}
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
