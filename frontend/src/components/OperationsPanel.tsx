import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  ExternalLink,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { parseJsonSafe } from '../api/client';

export type OperationsSection = 'overview' | 'recommendations' | 'keywords' | 'settings';

type RequestFn = (path: string, options?: RequestInit) => Promise<Response>;

type OverviewData = {
  account: {
    customerId: string;
    displayName: string | null;
    lastSyncedAt: string | null;
  };
  totals: {
    adGroups: number;
    lowAssets: number;
    recommendations: number;
    pending: number;
    approved: number;
    applied: number;
    rejected: number;
  };
  lastReviewAt: string | null;
  lastSync: { status: string; rowsRead: number; startedAt: string } | null;
  recentChanges: Array<{
    id: string;
    source: string;
    status: string;
    requestedAt: string;
    errorMessage: string | null;
  }>;
};

type SuggestionVariant = {
  id: string;
  content: { text?: string };
  selected: boolean;
};

type Recommendation = {
  id: string;
  suggestionType: string;
  fieldType: string | null;
  languageCode: string | null;
  currentContent: { text?: string; previewUrl?: string; impressions?: number };
  rationale: string;
  priority: string;
  confidence: string | null;
  status: string;
  createdAt: string;
  adGroup: { id: string; name: string } | null;
  provider: string | null;
  model: string | null;
  variants: SuggestionVariant[];
};

type CreativeTerm = {
  id: string;
  termType: string;
  languageCode: string;
  marketCode: string | null;
  scopeLevel: string;
  googleCampaignId: string | null;
  googleAdGroupId: string | null;
  term: string;
  weight: string;
  active: boolean;
};

type SettingsData = {
  account: {
    customerId: string;
    displayName: string | null;
    status: string;
    timeZone: string | null;
    lastSyncedAt: string | null;
  };
  policy: {
    name: string;
    languageStrategy: string;
    targetLanguage: string | null;
    selectionCriteria: { targetLabels?: string[] };
    headlineMaxLength: number;
    descriptionMaxLength: number;
    approvalMode: string;
    reviewIntervalDays: number;
    minimumImpressions: string;
    minimumClicks: string;
    cooldownDays: number;
    maxChangesPerRun: number;
  };
  providers: {
    googleAdsConfigured: boolean;
    geminiConfigured: boolean;
  };
};

type Props = {
  section: OperationsSection;
  customerId: string;
  request: RequestFn;
  onOpenAssets: (adGroupId: string) => void;
};

const TERM_TYPES = [
  ['KEYWORD', 'Product keyword'],
  ['BRAND_TERM', 'Brand term'],
  ['CTA', 'Call to action'],
  ['NEGATIVE_KEYWORD', 'Negative keyword'],
  ['PROHIBITED_CLAIM', 'Prohibited claim'],
] as const;

const LANGUAGE_OPTIONS = [
  ['en', 'English'],
  ['pt', 'Portuguese'],
  ['de', 'German'],
  ['es', 'Spanish'],
  ['fr', 'French'],
  ['it', 'Italian'],
  ['ar', 'Arabic'],
  ['he', 'Hebrew'],
  ['el', 'Greek'],
  ['ru', 'Russian/Cyrillic'],
  ['ko', 'Korean'],
  ['zh', 'Chinese'],
  ['ja', 'Japanese'],
  ['hi', 'Hindi/Devanagari'],
  ['bn', 'Bengali'],
  ['ta', 'Tamil'],
  ['te', 'Telugu'],
  ['th', 'Thai'],
  ['km', 'Khmer'],
  ['my', 'Burmese/Myanmar'],
  ['tr', 'Turkish'],
  ['pl', 'Polish'],
  ['vi', 'Vietnamese'],
] as const;

const SCOPE_OPTIONS = [
  ['ACCOUNT', 'Account'],
  ['CAMPAIGN', 'Campaign'],
  ['AD_GROUP', 'Ad group'],
] as const;

function errorMessage(body: any, fallback: string) {
  if (typeof body?.message === 'string') return body.message;
  if (Array.isArray(body?.message)) return body.message.join(', ');
  return fallback;
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not yet';
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function OperationsPanel({ section, customerId, request, onOpenAssets }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recommendationStatus, setRecommendationStatus] = useState('PENDING');
  const [decisionId, setDecisionId] = useState('');
  const [terms, setTerms] = useState<CreativeTerm[]>([]);
  const [termType, setTermType] = useState('KEYWORD');
  const [termLanguage, setTermLanguage] = useState('en');
  const [termMarket, setTermMarket] = useState('');
  const [termScope, setTermScope] = useState('ACCOUNT');
  const [termCampaignId, setTermCampaignId] = useState('');
  const [termAdGroupId, setTermAdGroupId] = useState('');
  const [termText, setTermText] = useState('');
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [settingsDraft, setSettingsDraft] = useState({
    languageStrategy: 'DETECT_FROM_ASSET',
    targetLanguage: '',
    minimumImpressions: 0,
    minimumClicks: 0,
    reviewIntervalDays: 14,
    cooldownDays: 14,
    maxChangesPerRun: 10,
  });

  async function loadOverview() {
    const response = await request(
      `/creative-operations/overview?${new URLSearchParams({ customerId })}`,
    );
    const body = await parseJsonSafe(response);
    if (!response.ok) throw new Error(errorMessage(body, 'Could not load overview'));
    setOverview(body as OverviewData);
  }

  async function loadRecommendations() {
    const params = new URLSearchParams({ customerId, status: recommendationStatus });
    const response = await request(`/creative-operations/recommendations?${params}`);
    const body = await parseJsonSafe(response);
    if (!response.ok) throw new Error(errorMessage(body, 'Could not load recommendations'));
    setRecommendations((body.recommendations ?? []) as Recommendation[]);
  }

  async function loadTerms() {
    const response = await request(
      `/creative-operations/terms?${new URLSearchParams({ customerId })}`,
    );
    const body = await parseJsonSafe(response);
    if (!response.ok) throw new Error(errorMessage(body, 'Could not load keyword rules'));
    setTerms((body.terms ?? []) as CreativeTerm[]);
  }

  async function loadSettings() {
    const response = await request(
      `/creative-operations/settings?${new URLSearchParams({ customerId })}`,
    );
    const body = await parseJsonSafe(response);
    if (!response.ok) throw new Error(errorMessage(body, 'Could not load settings'));
    const data = body as SettingsData;
    setSettings(data);
    setSettingsDraft({
      languageStrategy: data.policy.languageStrategy,
      targetLanguage: data.policy.targetLanguage ?? '',
      minimumImpressions: Number(data.policy.minimumImpressions),
      minimumClicks: Number(data.policy.minimumClicks),
      reviewIntervalDays: data.policy.reviewIntervalDays,
      cooldownDays: data.policy.cooldownDays,
      maxChangesPerRun: data.policy.maxChangesPerRun,
    });
  }

  async function loadSection() {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      if (section === 'overview') await loadOverview();
      if (section === 'recommendations') await loadRecommendations();
      if (section === 'keywords') await loadTerms();
      if (section === 'settings') await loadSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSection();
  }, [section, customerId, recommendationStatus]);

  async function decide(item: Recommendation, action: 'APPROVE' | 'REJECT' | 'UNAPPROVE') {
    setDecisionId(item.id);
    setError('');
    try {
      const response = await request(
        `/google-ads/assets/ai-suggestions/${item.id}/decision`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            variantId: action === 'APPROVE' ? item.variants[0]?.id : undefined,
          }),
        },
      );
      const body = await parseJsonSafe(response);
      if (!response.ok) throw new Error(errorMessage(body, 'Could not save decision'));
      setRecommendations((current) =>
        recommendationStatus === 'ALL'
          ? current.map((entry) =>
              entry.id === item.id ? { ...entry, status: body.status } : entry,
            )
          : current.filter((entry) => entry.id !== item.id),
      );
      setNotice(`Suggestion ${body.status.toLowerCase()}. Google Ads has not been changed.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save decision');
    } finally {
      setDecisionId('');
    }
  }

  async function createTerm() {
    if (!termText.trim()) return;
    setLoading(true);
    setError('');
    try {
      const response = await request('/creative-operations/terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          termType,
          languageCode: termLanguage,
          marketCode: termMarket.trim() || null,
          scopeLevel: termScope,
          googleCampaignId: termScope === 'CAMPAIGN' ? termCampaignId : null,
          googleAdGroupId: termScope === 'AD_GROUP' ? termAdGroupId : null,
          term: termText.trim(),
        }),
      });
      const body = await parseJsonSafe(response);
      if (!response.ok) throw new Error(errorMessage(body, 'Could not create keyword rule'));
      setTermText('');
      if (termScope === 'ACCOUNT') {
        setTermCampaignId('');
        setTermAdGroupId('');
      }
      setNotice('Keyword rule added. New AI reviews will use this policy data.');
      await loadTerms();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create keyword rule');
    } finally {
      setLoading(false);
    }
  }

  async function updateTerm(item: CreativeTerm, update: Partial<CreativeTerm>) {
    setError('');
    try {
      const response = await request(`/creative-operations/terms/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });
      const body = await parseJsonSafe(response);
      if (!response.ok) throw new Error(errorMessage(body, 'Could not update keyword rule'));
      setTerms((current) => current.map((term) => (term.id === item.id ? body : term)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update keyword rule');
    }
  }

  async function deleteTerm(item: CreativeTerm) {
    setError('');
    try {
      const response = await request(`/creative-operations/terms/${item.id}`, {
        method: 'DELETE',
      });
      const body = await parseJsonSafe(response);
      if (!response.ok) throw new Error(errorMessage(body, 'Could not delete keyword rule'));
      setTerms((current) => current.filter((term) => term.id !== item.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete keyword rule');
    }
  }

  async function saveSettings() {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const params = new URLSearchParams({ customerId });
      const response = await request(`/creative-operations/settings?${params}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...settingsDraft,
          targetLanguage:
            settingsDraft.languageStrategy === 'FIXED'
              ? settingsDraft.targetLanguage
              : null,
          targetLabels: ['LOW'],
        }),
      });
      const body = await parseJsonSafe(response);
      if (!response.ok) throw new Error(errorMessage(body, 'Could not save settings'));
      setNotice('AI review policy saved.');
      await loadSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save settings');
    } finally {
      setLoading(false);
    }
  }

  const title = {
    overview: 'Overview',
    recommendations: 'Recommendations',
    keywords: 'AI keyword rules',
    settings: 'Settings',
  }[section];
  const subtitle = {
    overview: 'AI review status, LOW assets, and recent Google Ads changes.',
    recommendations: 'Approve or reject AI ideas before opening the ad group to apply them.',
    keywords: 'Product terms, brand language, negative terms, and prohibited claims used by AI.',
    settings: 'Google Ads connection status and creative review policy.',
  }[section];
  const groupedTerms = useMemo(
    () =>
      TERM_TYPES.map(([type, label]) => ({
        type,
        label,
        terms: terms.filter((item) => item.termType === type),
      })),
    [terms],
  );
  const canCreateTerm =
    Boolean(termText.trim()) &&
    (termScope === 'ACCOUNT' ||
      (termScope === 'CAMPAIGN' && Boolean(termCampaignId.trim())) ||
      (termScope === 'AD_GROUP' && Boolean(termAdGroupId.trim())));

  function scopeLabel(item: CreativeTerm) {
    if (item.scopeLevel === 'AD_GROUP') return `Ad group ${item.googleAdGroupId ?? '-'}`;
    if (item.scopeLevel === 'CAMPAIGN') return `Campaign ${item.googleCampaignId ?? '-'}`;
    return 'Account';
  }

  return (
    <div className="operationsPage">
      <header className="operationsHeader">
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <button className="iconAction" type="button" onClick={() => void loadSection()} disabled={loading} title="Refresh">
          <RefreshCw size={17} className={loading ? 'spin' : ''} />
        </button>
      </header>

      {error ? <div className="inlineError"><AlertCircle size={16} />{error}</div> : null}
      {notice ? <div className="inlineSuccess"><Check size={16} />{notice}</div> : null}

      {section === 'overview' && overview ? (
        <>
          <div className="operationsMetrics">
            <div><span>LOW assets</span><strong>{overview.totals.lowAssets}</strong></div>
            <div><span>Pending review</span><strong>{overview.totals.pending}</strong></div>
            <div><span>Approved</span><strong>{overview.totals.approved}</strong></div>
            <div><span>Applied</span><strong>{overview.totals.applied}</strong></div>
          </div>
          <section className="operationsSection">
            <div className="sectionTitle"><h2>Activity</h2><span>Customer {overview.account.customerId}</span></div>
            <div className="activityGrid">
              <div><span>Ad groups in database</span><strong>{overview.totals.adGroups}</strong></div>
              <div><span>Last AI review</span><strong>{formatDate(overview.lastReviewAt)}</strong></div>
              <div><span>Last selective sync</span><strong>{formatDate(overview.lastSync?.startedAt)}</strong></div>
              <div><span>Last sync status</span><strong>{overview.lastSync?.status ?? 'Not yet'}</strong></div>
            </div>
          </section>
          <section className="operationsSection">
            <div className="sectionTitle"><h2>Recent changes</h2><span>{overview.recentChanges.length} records</span></div>
            <div className="plainTable"><table><thead><tr><th>Time</th><th>Source</th><th>Status</th><th>Error</th></tr></thead><tbody>
              {overview.recentChanges.map((item) => <tr key={item.id}><td>{formatDate(item.requestedAt)}</td><td>{item.source}</td><td><span className={`statusText ${item.status.toLowerCase()}`}>{item.status}</span></td><td>{item.errorMessage ?? '-'}</td></tr>)}
              {!overview.recentChanges.length ? <tr><td colSpan={4} className="empty">No Google Ads changes recorded yet.</td></tr> : null}
            </tbody></table></div>
          </section>
        </>
      ) : null}

      {section === 'recommendations' ? (
        <section className="operationsSection flush">
          <div className="recommendationToolbar">
            <div className="statusTabs">
              {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map((status) => (
                <button type="button" className={recommendationStatus === status ? 'active' : ''} key={status} onClick={() => setRecommendationStatus(status)}>{status}</button>
              ))}
            </div>
            <span>{recommendations.length} suggestions</span>
          </div>
          <div className="recommendationQueue">
            {recommendations.map((item) => {
              const replacement = item.variants[0]?.content.text ?? 'Creative concept';
              return <article className="queueRow" key={item.id}>
                <div className="queueMeta"><span className="textType">{item.fieldType ?? item.suggestionType}</span><span>{item.priority}</span><span>{item.languageCode?.toUpperCase() ?? '-'}</span><span>{item.adGroup?.name ?? 'Ad group unavailable'}</span></div>
                <div className="queueCopy"><div><span>Current</span><strong>{item.currentContent.text ?? item.suggestionType}</strong></div><div><span>AI suggestion</span><strong>{replacement}</strong></div></div>
                <p>{item.rationale}</p>
                <div className="queueActions">
                  {item.status !== 'APPROVED' ? <button type="button" className="tableActionButton" disabled={decisionId === item.id} onClick={() => void decide(item, 'APPROVE')}><Check size={14} />Approve</button> : <button type="button" className="tableActionButton" disabled={decisionId === item.id} onClick={() => void decide(item, 'UNAPPROVE')}><X size={14} />Unapprove</button>}
                  {item.status !== 'REJECTED' ? <button type="button" className="tableActionButton subtleDanger" disabled={decisionId === item.id} onClick={() => void decide(item, 'REJECT')}><X size={14} />Reject</button> : null}
                  {item.adGroup ? <button type="button" className="tableActionButton" onClick={() => onOpenAssets(item.adGroup!.id)}><ExternalLink size={14} />Open ad group</button> : null}
                </div>
              </article>;
            })}
            {!loading && !recommendations.length ? <div className="emptyState">No recommendations in this status.</div> : null}
          </div>
        </section>
      ) : null}

      {section === 'keywords' ? (
        <>
          <section className="termComposer">
            <label><span>Type</span><select value={termType} onChange={(event) => setTermType(event.target.value)}>{TERM_TYPES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
            <label><span>Language</span><select value={termLanguage} onChange={(event) => setTermLanguage(event.target.value)}>{LANGUAGE_OPTIONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
            <label><span>Market</span><input value={termMarket} onChange={(event) => setTermMarket(event.target.value.toUpperCase())} placeholder="BR" maxLength={16} /></label>
            <label><span>Scope</span><select value={termScope} onChange={(event) => { setTermScope(event.target.value); setTermCampaignId(''); setTermAdGroupId(''); }}>{SCOPE_OPTIONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
            {termScope === 'CAMPAIGN' ? <label><span>Campaign ID</span><input value={termCampaignId} onChange={(event) => setTermCampaignId(event.target.value.replace(/\D/g, ''))} placeholder="Campaign ID" /></label> : null}
            {termScope === 'AD_GROUP' ? <label><span>Ad group ID</span><input value={termAdGroupId} onChange={(event) => setTermAdGroupId(event.target.value.replace(/\D/g, ''))} placeholder="Ad group ID" /></label> : null}
            <label className="termInput"><span>Term</span><input value={termText} onChange={(event) => setTermText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void createTerm(); }} placeholder="Enter a keyword or phrase" /></label>
            <button className="primaryButton" type="button" disabled={loading || !canCreateTerm} onClick={() => void createTerm()}><Plus size={15} />Add</button>
          </section>
          {groupedTerms.map((group) => <section className="operationsSection" key={group.type}><div className="sectionTitle"><h2>{group.label}</h2><span>{group.terms.length}</span></div><div className="plainTable"><table><thead><tr><th>Term</th><th>Language</th><th>Market</th><th>Scope</th><th>Weight</th><th>Active</th><th></th></tr></thead><tbody>
            {group.terms.map((item) => <tr key={item.id}><td><strong>{item.term}</strong></td><td>{item.languageCode.toUpperCase()}</td><td>{item.marketCode ?? '-'}</td><td>{scopeLabel(item)}</td><td>{Number(item.weight).toFixed(1)}</td><td><label className="switchControl"><input type="checkbox" checked={item.active} onChange={() => void updateTerm(item, { active: !item.active })} /><span /></label></td><td><button className="iconAction danger" type="button" title="Delete" onClick={() => void deleteTerm(item)}><Trash2 size={15} /></button></td></tr>)}
            {!group.terms.length ? <tr><td colSpan={7} className="empty">No terms in this group.</td></tr> : null}
          </tbody></table></div></section>)}
        </>
      ) : null}

      {section === 'settings' && settings ? (
        <>
          <section className="operationsSection">
            <div className="sectionTitle"><h2>Connections</h2><span>{settings.account.displayName}</span></div>
            <div className="connectionRows"><div><span>Google Ads API</span><strong className={settings.providers.googleAdsConfigured ? 'connected' : 'disconnected'}>{settings.providers.googleAdsConfigured ? 'Connected' : 'Missing configuration'}</strong></div><div><span>Gemini API</span><strong className={settings.providers.geminiConfigured ? 'connected' : 'disconnected'}>{settings.providers.geminiConfigured ? 'Connected' : 'Missing configuration'}</strong></div><div><span>Customer</span><strong>{settings.account.customerId}</strong></div><div><span>Last sync</span><strong>{formatDate(settings.account.lastSyncedAt)}</strong></div></div>
          </section>
          <section className="operationsSection">
            <div className="sectionTitle"><div><h2>AI review policy</h2><p>{settings.policy.name}</p></div><span>Manual approval</span></div>
            <div className="settingsGrid">
              <label><span>Language strategy</span><select value={settingsDraft.languageStrategy} onChange={(event) => setSettingsDraft((current) => ({ ...current, languageStrategy: event.target.value }))}><option value="DETECT_FROM_ASSET">Detect from each asset</option><option value="FIXED">Use one language</option></select></label>
              <label><span>Target language</span><select disabled={settingsDraft.languageStrategy !== 'FIXED'} value={settingsDraft.targetLanguage} onChange={(event) => setSettingsDraft((current) => ({ ...current, targetLanguage: event.target.value }))}><option value="">Choose language</option>{LANGUAGE_OPTIONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
              <label><span>Minimum impressions</span><input type="number" min="0" value={settingsDraft.minimumImpressions} onChange={(event) => setSettingsDraft((current) => ({ ...current, minimumImpressions: Number(event.target.value) }))} /></label>
              <label><span>Minimum clicks</span><input type="number" min="0" value={settingsDraft.minimumClicks} onChange={(event) => setSettingsDraft((current) => ({ ...current, minimumClicks: Number(event.target.value) }))} /></label>
              <label><span>Review interval (days)</span><input type="number" min="1" value={settingsDraft.reviewIntervalDays} onChange={(event) => setSettingsDraft((current) => ({ ...current, reviewIntervalDays: Number(event.target.value) }))} /></label>
              <label><span>Cooldown after change (days)</span><input type="number" min="0" value={settingsDraft.cooldownDays} onChange={(event) => setSettingsDraft((current) => ({ ...current, cooldownDays: Number(event.target.value) }))} /></label>
              <label><span>Maximum changes per run</span><input type="number" min="1" max="100" value={settingsDraft.maxChangesPerRun} onChange={(event) => setSettingsDraft((current) => ({ ...current, maxChangesPerRun: Number(event.target.value) }))} /></label>
              <label><span>Asset label</span><input value="LOW" disabled /></label>
            </div>
            <div className="settingsActions"><span>Headline {settings.policy.headlineMaxLength} chars · Description {settings.policy.descriptionMaxLength} chars</span><button className="primaryButton" type="button" disabled={loading} onClick={() => void saveSettings()}><Save size={15} />Save policy</button></div>
          </section>
        </>
      ) : null}

      {loading && !overview && !recommendations.length && !terms.length && !settings ? <div className="pageLoading"><RefreshCw size={18} className="spin" />Loading</div> : null}
    </div>
  );
}
