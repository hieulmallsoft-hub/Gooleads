import assert from 'node:assert/strict';
import test from 'node:test';
import { AiReviewService } from './ai-review.service';
import { GoogleAdsService } from './google-ads.service';

test('AI text suggestions sync, authorize, generate, then persist', async () => {
  const calls: string[] = [];
  const service = new AiReviewService(
    { sync: async () => calls.push('sync') } as any,
    { generateAiTextSuggestions: async () => (calls.push('generate'), { suggestions: [1] }) } as any,
    { saveTextSuggestions: async () => (calls.push('save'), { reviewRunId: 'r1' }) } as any,
    { assertCanEditAdGroup: async () => calls.push('access') } as any,
  );
  const result = await service.generateTextSuggestions(
    '1234567890',
    'ag1',
    'TODAY',
    { role: 'EDITOR' } as any,
  );
  assert.deepEqual(result, { reviewRunId: 'r1' });
  assert.deepEqual(calls, ['sync', 'access', 'generate', 'save']);
});

test('AI review detects Indonesian copy and rejects German replacement ideas', () => {
  const service = new GoogleAdsService({} as any, {} as any, {} as any) as any;
  const language = service.detectTextLanguage('Kendali AC LG via HP dengan mudah');
  const asset = {
    mediaType: 'Text',
    fieldType: 'HEADLINE',
    sourceLanguageCode: language.code,
    targetLanguageCode: 'auto',
  };

  assert.equal(language.code, 'id');
  assert.deepEqual(
    service.normalizeReviewReplacementIdeas(
      ['Klimaanlage per Handy steuern', 'Einfache AC Steuerung'],
      asset,
    ),
    ['Kontrol AC Lewat Ponsel', 'Atur AC dari Ponsel'],
  );
});

test('AI review keeps each asset visible language instead of forcing the group language', () => {
  const service = new GoogleAdsService({} as any, {} as any, {} as any) as any;
  const english = service.detectTextLanguage("Upgrade your mobile's look and feel instantly");
  const target = service.resolveAssetTargetLanguage(
    english,
    { code: 'fr', name: 'French', confidence: 'HIGH' },
    { languageStrategy: 'FIXED', targetLanguage: 'fr' },
    true,
  );

  assert.equal(english.code, 'en');
  assert.equal(english.confidence, 'HIGH');
  assert.equal(target.code, 'en');
  assert.equal(
    service.isReplacementLanguageMismatch(
      "Transformez l'écran de votre téléphone avec des fonds animés.",
      target.code,
    ),
    true,
  );
});
