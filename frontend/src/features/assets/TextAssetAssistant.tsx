import { useEffect, useState } from 'react';
import { CheckCircle2, Languages, PenLine, RefreshCw, Sparkles, X } from 'lucide-react';
import type { Asset, LowTextSuggestion, TextChangeRequest } from '../../types/googleAds';

type EditMode = 'AI' | 'MANUAL';

type Props = {
  asset: Asset | null;
  suggestion: LowTextSuggestion | null;
  suggestionLoading: boolean;
  suggestionSelected: boolean;
  translation: string;
  translationLoading: boolean;
  suggestionError: string;
  translationError: string;
  canEdit: boolean;
  preview: TextChangeRequest | null;
  confirmed: boolean;
  applying: boolean;
  manualText: string;
  targetLanguageName: string;
  languageSource: 'AD_GROUP_CONFIG' | 'DETECTED' | '';
  adGroupTopic: string;
  onClose: () => void;
  onGenerate: () => void;
  onTranslate: () => void;
  onToggleSuggestion: () => void;
  onManualTextChange: (value: string) => void;
  onCreatePreview: () => void;
  onConfirmedChange: (value: boolean) => void;
  onApply: () => void;
};

export function TextAssetAssistant(props: Props) {
  const { asset, suggestion, preview } = props;
  const [mode, setMode] = useState<EditMode>('AI');

  useEffect(() => {
    setMode(asset?.performanceLabel === 'LOW' ? 'AI' : 'MANUAL');
  }, [asset?.id, asset?.fieldType, asset?.text, asset?.performanceLabel]);

  useEffect(() => {
    if (!asset) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') props.onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [asset, props.onClose]);

  if (!asset) return null;
  const isLow = asset.performanceLabel === 'LOW';
  const previewReady = preview?.status === 'PENDING';
  const textLimit = asset.fieldType === 'HEADLINE' ? 30 : 60;
  const manualValue = props.manualText.trim();
  const hasManualText = manualValue.length > 0 && manualValue !== asset.text.trim();
  const canPreview = mode === 'AI' ? Boolean(suggestion && props.suggestionSelected) : hasManualText;

  function chooseMode(nextMode: EditMode) {
    setMode(nextMode);
    props.onConfirmedChange(false);
    if (nextMode === 'AI') props.onManualTextChange('');
    if (nextMode === 'MANUAL' && props.suggestionSelected) props.onToggleSuggestion();
  }

  return (
    <div className="textAssistantBackdrop" role="presentation" onMouseDown={props.onClose}>
      <section className="textAssistant" role="dialog" aria-modal="true" aria-label="Trợ lý chỉnh sửa nội dung" onMouseDown={(event) => event.stopPropagation()}>
        <header className="textAssistantHeader">
          <div>
            <span>{asset.fieldType === 'HEADLINE' ? 'Tiêu đề quảng cáo' : 'Mô tả quảng cáo'} · {asset.performanceLabel || 'Chưa có nhãn'}</span>
            <h2>Chỉnh sửa nội dung</h2>
          </div>
          <button className="iconButton" type="button" onClick={props.onClose} aria-label="Đóng"><X size={18} /></button>
        </header>

        <div className="textAssistantContent">
          <div className="textAssistantCurrent">
            <span>Nội dung hiện tại</span>
            <strong>{asset.text}</strong>
            <button className="tableActionButton translationButton" type="button" onClick={props.onTranslate} disabled={props.translationLoading}>
              {props.translationLoading ? <RefreshCw size={14} className="spin" /> : <Languages size={14} />}
              {props.translationLoading ? 'Đang dịch...' : props.translation ? 'Dịch lại' : 'Dịch nghĩa tiếng Việt'}
            </button>
            {props.translation ? (
              <div className="translationResult"><CheckCircle2 size={16} /><div><b>Nghĩa tiếng Việt</b><p>{props.translation}</p></div></div>
            ) : null}
          </div>

          <div className="editModePicker" role="radiogroup" aria-label="Chọn cách chỉnh sửa">
            <button type="button" className={mode === 'AI' ? 'active' : ''} disabled={!isLow} onClick={() => chooseMode('AI')}>
              <Sparkles size={16} /><span><strong>Dùng gợi ý AI</strong><small>AI viết lại theo ngôn ngữ gốc</small></span>
            </button>
            <button type="button" className={mode === 'MANUAL' ? 'active' : ''} onClick={() => chooseMode('MANUAL')}>
              <PenLine size={16} /><span><strong>Tự nhập nội dung</strong><small>Bạn kiểm soát hoàn toàn câu chữ</small></span>
            </button>
          </div>

          {mode === 'AI' && isLow ? (
            <div className="textAssistantSuggestion">
              <div className={`assistantLanguageNotice${props.languageSource === 'AD_GROUP_CONFIG' ? ' configured' : ' warning'}`}>
                <Languages size={16} />
                <div>
                  <strong>AI sẽ viết bằng: {props.targetLanguageName || 'Chưa xác định chắc chắn'}</strong>
                  <small>
                    {props.languageSource === 'AD_GROUP_CONFIG'
                      ? `Theo cấu hình nhóm quảng cáo${props.adGroupTopic ? ` · Chủ đề: ${props.adGroupTopic}` : ''}`
                      : props.targetLanguageName
                        ? 'Đang suy đoán từ nội dung. Nên cấu hình ngôn ngữ và chủ đề để kết quả ổn định hơn.'
                        : 'Chưa tải thông tin ngôn ngữ. Bấm “Tạo gợi ý” để hệ thống đọc cấu hình nhóm quảng cáo.'}
                  </small>
                </div>
              </div>
              <div className="textAssistantSectionTitle">
                <strong>Gợi ý thay thế</strong>
                <button className="tableActionButton" type="button" onClick={props.onGenerate} disabled={!props.canEdit || props.suggestionLoading}>
                  {props.suggestionLoading ? <RefreshCw size={14} className="spin" /> : <Sparkles size={14} />}
                  {suggestion ? 'Tạo gợi ý khác' : 'Tạo gợi ý'}
                </button>
              </div>
              {suggestion ? (
                <label className={`aiSuggestionChoice${props.suggestionSelected ? ' selected' : ''}`}>
                  <input type="checkbox" checked={props.suggestionSelected} onChange={props.onToggleSuggestion} disabled={!props.canEdit} />
                  <span><small>Đề xuất của AI · {props.targetLanguageName}</small><strong>{suggestion.suggestion}</strong><em>Theo ngôn ngữ nhóm quảng cáo và trong giới hạn {textLimit} ký tự.</em></span>
                </label>
              ) : !props.suggestionLoading ? <div className="assistantEmpty"><Sparkles size={18} /><span>Bấm “Tạo gợi ý” để viết lại riêng nội dung này.</span></div> : null}
            </div>
          ) : (
            <div className="textAssistantManual">
              <div><strong>Nội dung thay thế</strong><span className={props.manualText.length >= textLimit ? 'limit' : ''}>{props.manualText.length}/{textLimit} ký tự</span></div>
              <textarea value={props.manualText} maxLength={textLimit} rows={asset.fieldType === 'HEADLINE' ? 2 : 4} disabled={!props.canEdit} onChange={(event) => props.onManualTextChange(event.target.value)} placeholder={asset.fieldType === 'HEADLINE' ? 'Nhập tiêu đề mới...' : 'Nhập mô tả mới...'} autoFocus />
              <small>Chỉ thay đúng nội dung “{asset.text}”.</small>
            </div>
          )}

          {previewReady ? (
            <div className="assistantApplyBox">
              <div><CheckCircle2 size={18} /><span><strong>Bản xem trước đã sẵn sàng</strong><small>Kiểm tra lần cuối trước khi gửi lên Google Ads.</small></span></div>
              <label><input type="checkbox" checked={props.confirmed} onChange={(event) => props.onConfirmedChange(event.target.checked)} /> Tôi đã kiểm tra và đồng ý áp dụng thay đổi này</label>
            </div>
          ) : null}
          {props.suggestionError ? <div className="inlineError"><strong>Lỗi tạo gợi ý AI:</strong> {props.suggestionError}</div> : null}
          {props.translationError ? <div className="inlineError"><strong>Lỗi dịch:</strong> {props.translationError}</div> : null}
        </div>

        <footer className="textAssistantFooter">
          <button className="secondaryButton" type="button" onClick={props.onClose}>Hủy</button>
          {previewReady ? (
            <button className="primaryButton" type="button" onClick={props.onApply} disabled={!props.confirmed || props.applying}>{props.applying ? 'Đang áp dụng...' : 'Áp dụng lên Google Ads'}</button>
          ) : (
            <button className="primaryButton" type="button" onClick={props.onCreatePreview} disabled={!props.canEdit || !canPreview || props.applying}>{props.applying ? 'Đang chuẩn bị...' : 'Tạo bản xem trước'}</button>
          )}
        </footer>
      </section>
    </div>
  );
}
