import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiTextSuggestionsPanel } from './AiTextSuggestionsPanel';
import { MediaReplacementPanel } from './MediaReplacementPanel';
import type { Asset } from '../../types/googleAds';

afterEach(cleanup);

const imageAsset: Asset = {
  id: 'asset-1',
  resourceName: 'customers/1/assets/1',
  adResourceName: 'customers/1/ads/1',
  name: 'Hình ảnh thử nghiệm',
  type: 'IMAGE',
  fieldType: 'MARKETING_IMAGE',
  text: '',
  imageUrl: 'https://example.com/image.jpg',
  imageWidth: 1200,
  imageHeight: 628,
  videoId: '',
  impressions: 100,
  clicks: 10,
  ctr: 0.1,
  cost: 20,
  conversions: 2,
  conversionValue: 50,
  cpa: 10,
  roas: 2.5,
  score: 80,
  performanceLabel: 'LOW',
  assessment: '',
  action: '',
  reason: '',
};

describe('Thao tác tài nguyên và phân quyền', () => {
  it('không cho người chỉ có quyền xem thay hình ảnh', () => {
    const onReplace = vi.fn();
    render(
      <MediaReplacementPanel
        target={imageAsset}
        mediaType="IMAGE"
        previewUrl={imageAsset.imageUrl}
        replacementImageInfo={null}
        replacementVideoUrl=""
        confirmed={false}
        loading={false}
        disabled
        canEdit={false}
        error=""
        status=""
        onImageFileChange={vi.fn()}
        onVideoUrlChange={vi.fn()}
        onConfirmedChange={vi.fn()}
        onReplace={onReplace}
      />,
    );
    expect(screen.getByRole('button', { name: 'Thay hình ảnh/video' })).toBeDisabled();
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });

  it('gửi thao tác thay media khi người dùng có quyền và đã xác nhận', () => {
    const onReplace = vi.fn();
    render(
      <MediaReplacementPanel
        target={imageAsset}
        mediaType="IMAGE"
        previewUrl={imageAsset.imageUrl}
        replacementImageInfo={null}
        replacementVideoUrl=""
        confirmed
        loading={false}
        disabled={false}
        canEdit
        error=""
        status=""
        onImageFileChange={vi.fn()}
        onVideoUrlChange={vi.fn()}
        onConfirmedChange={vi.fn()}
        onReplace={onReplace}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Thay hình ảnh/video' }));
    expect(onReplace).toHaveBeenCalledOnce();
  });

  it('cho phép phê duyệt đề xuất AI khi có quyền chỉnh sửa', () => {
    const onToggleApproval = vi.fn();
    const suggestion = {
      key: 'suggestion-1',
      suggestionId: 'suggestion-1',
      variants: [{ id: 'variant-1', text: 'Mới' }],
      fieldType: 'HEADLINE',
      text: 'Cũ',
      suggestion: 'Mới',
      impressions: 100,
      priority: 'HIGH',
      confidence: 'HIGH',
    };
    render(
      <AiTextSuggestionsPanel
        assetData={{ adGroupId: '1', assets: [], timeRange: 'LAST_7_DAYS', totalImpressions: 0, totalClicks: 0, totalCost: 0, totalConversions: 0, avgCtr: 0, avgRoas: 0 }}
        aiTextSuggestions={null}
        lowTextAssetCount={1}
        totalLowTextImpressions={100}
        lowTextCandidateCount={1}
        lowTextSuggestions={[suggestion] as never[]}
        selectedLowTextSuggestions={[]}
        selectedTextSuggestionSet={new Set()}
        decisionLoadingIds={[]}
        replacementHeadline=""
        replacementDescription=""
        textChangeRequest={null}
        replaceConfirmed={false}
        autoAiEnabled={false}
        canEdit
        aiTextLoading={false}
        aiTextDisabled={false}
        replaceLoading={false}
        createTextChangeDisabled
        applyTextChangeDisabled
        replaceError=""
        aiTextError=""
        replaceStatus=""
        onAutoAiChange={vi.fn()}
        onGenerate={vi.fn()}
        onToggleApproval={onToggleApproval}
        onToggleAllApprovals={vi.fn()}
        onHeadlineChange={vi.fn()}
        onDescriptionChange={vi.fn()}
        onReplaceConfirmedChange={vi.fn()}
        onCreatePreview={vi.fn()}
        onApplyPreview={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText('Phê duyệt'));
    expect(onToggleApproval).toHaveBeenCalledOnce();
  });
});
