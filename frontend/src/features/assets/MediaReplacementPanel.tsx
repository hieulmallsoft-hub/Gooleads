import { Image, RefreshCw, Sparkles, Video } from 'lucide-react';
import { assetTitle } from '../../utils/assets';
import { formatNumber, formatPercent } from '../../utils/format';
import type { Asset, ReplacementImageInfo } from '../../types/googleAds';

type MediaReplacementPanelProps = {
  target: Asset | null;
  mediaType: string;
  previewUrl: string;
  replacementImageInfo: ReplacementImageInfo | null;
  replacementVideoUrl: string;
  confirmed: boolean;
  loading: boolean;
  disabled: boolean;
  canEdit: boolean;
  error: string;
  status: string;
  onImageFileChange: (file: File | null) => void;
  onVideoUrlChange: (value: string) => void;
  onConfirmedChange: (confirmed: boolean) => void;
  onReplace: () => void;
};

export function MediaReplacementPanel({
  target,
  mediaType,
  previewUrl,
  replacementImageInfo,
  replacementVideoUrl,
  confirmed,
  loading,
  disabled,
  canEdit,
  error,
  status,
  onImageFileChange,
  onVideoUrlChange,
  onConfirmedChange,
  onReplace,
}: MediaReplacementPanelProps) {
  return (
    <section className="assetEditor">
      <div className="editorHeader">
        <div>
          <h2>Thay hình ảnh/video</h2>
          <p>
            {target
              ? `Đã chọn ${mediaType === 'VIDEO' ? 'video' : 'hình ảnh'} · ${formatNumber(target.impressions)} lượt hiển thị`
              : 'Chọn một dòng HÌNH ẢNH hoặc VIDEO trong bảng'}
          </p>
        </div>
        <span className="pill">Cập nhật Google Ads</span>
      </div>

      {target ? (
        <div className="mediaReplaceGrid">
          <div className="mediaTarget">
            <div className="assetPreview compactPreview">
              {previewUrl ? (
                <img src={previewUrl} alt="" />
              ) : (
                <span className="assetPreviewIcon">
                  {mediaType === 'VIDEO' ? <Video size={22} /> : <Image size={22} />}
                </span>
              )}
            </div>
            <div>
              <span className="textType">{mediaType}</span>
              <strong>{assetTitle(target)}</strong>
              <p>
                {formatPercent(target.ctr)} CTR - {target.roas.toFixed(2)} ROAS - {target.performanceLabel || 'Không có nhãn'}
              </p>
            </div>
          </div>

          {mediaType === 'IMAGE' ? (
            <label className="editorField">
              <span>Hình ảnh mới</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                disabled={!canEdit}
                onChange={(event) => onImageFileChange(event.target.files?.[0] ?? null)}
              />
              {replacementImageInfo ? (
                <span className="imageSpecNote">
                  {replacementImageInfo.adjusted ? 'Đã tự động cắt' : 'Sẵn sàng'} cho {replacementImageInfo.specLabel}: {replacementImageInfo.originalWidth}x{replacementImageInfo.originalHeight}{' thành '}{replacementImageInfo.outputWidth}x{replacementImageInfo.outputHeight}
                </span>
              ) : null}
            </label>
          ) : (
            <label className="editorField">
              <span>Video YouTube mới</span>
              <input
                value={replacementVideoUrl}
                disabled={!canEdit}
                onChange={(event) => onVideoUrlChange(event.target.value)}
                placeholder="https://youtu.be/..."
              />
            </label>
          )}
        </div>
      ) : (
        <div className="emptySuggestions">
          Chọn một tài nguyên hình ảnh hoặc video bằng nút Thay thế trong bảng.
        </div>
      )}

      <div className="editorFooter">
        <label className="confirmRow">
          <input
            type="checkbox"
            checked={confirmed}
            disabled={!canEdit}
            onChange={(event) => onConfirmedChange(event.target.checked)}
          />
          <span>Áp dụng thay đổi hình ảnh/video này lên Google Ads</span>
        </label>
        <button
          className="primaryButton editorAction"
          type="button"
          onClick={onReplace}
          disabled={!canEdit || disabled}
        >
          {loading ? (
            <RefreshCw size={15} className="spin" />
          ) : (
            <Sparkles size={15} />
          )}
          {loading ? 'Đang cập nhật...' : 'Thay hình ảnh/video'}
        </button>
      </div>

      {error ? <div className="inlineError">{error}</div> : null}
      {status ? <div className="inlineSuccess">{status}</div> : null}
    </section>
  );
}
