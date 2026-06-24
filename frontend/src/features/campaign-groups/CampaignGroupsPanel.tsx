import {
  Check,
  Folder,
  FolderPlus,
  Pencil,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch, extractApiError, parseJsonSafe } from '../../api/client';
import { formatNumber, formatPercent } from '../../utils/format';
import type {
  Campaign,
  CampaignGroup,
  CampaignGroupResponse,
} from '../../types/googleAds';

const GROUP_COLORS = ['#1a73e8', '#188038', '#f9ab00', '#d93025', '#a142f4', '#007b83'];

type CampaignGroupsPanelProps = {
  customerId: string;
  campaigns: Campaign[];
  onFilterChange: (campaignIds: string[] | null) => void;
};

export function CampaignGroupsPanel({
  customerId,
  campaigns,
  onFilterChange,
}: CampaignGroupsPanelProps) {
  const [groups, setGroups] = useState<CampaignGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupColor, setGroupColor] = useState(GROUP_COLORS[0]);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? null;

  const selectedCampaigns = useMemo(() => {
    if (!selectedGroup) return campaigns;
    const memberIds = new Set(selectedGroup.campaigns.map((campaign) => campaign.id));
    return campaigns.filter((campaign) => memberIds.has(campaign.id));
  }, [campaigns, selectedGroup]);

  const metrics = useMemo(() => {
    const impressions = selectedCampaigns.reduce((sum, campaign) => sum + campaign.impressions, 0);
    const clicks = selectedCampaigns.reduce((sum, campaign) => sum + campaign.clicks, 0);
    const cost = selectedCampaigns.reduce((sum, campaign) => sum + campaign.cost, 0);
    const conversionValue = selectedCampaigns.reduce(
      (sum, campaign) => sum + campaign.conversionValue,
      0,
    );
    return {
      impressions,
      cost,
      ctr: impressions > 0 ? clicks / impressions : 0,
      roas: cost > 0 ? conversionValue / cost : 0,
    };
  }, [selectedCampaigns]);

  async function loadGroups() {
    if (!customerId) return;
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch(
        `/campaign-groups?${new URLSearchParams({ customerId })}`,
      );
      const body = await parseJsonSafe(response);
      if (!response.ok) throw new Error(extractApiError(body, 'Could not load campaign groups'));
      const result = body as CampaignGroupResponse;
      setGroups(result.groups);
      setSelectedGroupId((current) =>
        current && result.groups.some((group) => group.id === current) ? current : '',
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load campaign groups');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setSelectedGroupId('');
    onFilterChange(null);
    void loadGroups();
  }, [customerId]);

  useEffect(() => {
    onFilterChange(
      selectedGroup
        ? selectedGroup.campaigns.map((campaign) => campaign.id)
        : null,
    );
  }, [selectedGroup]);

  async function createGroup() {
    const name = groupName.trim();
    if (!name) {
      setError('Enter a group name');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const response = await apiFetch('/campaign-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, name, color: groupColor }),
      });
      const body = await parseJsonSafe(response);
      if (!response.ok) throw new Error(extractApiError(body, 'Could not create campaign group'));
      setGroupName('');
      setCreateOpen(false);
      await loadGroups();
      setSelectedGroupId(body.id);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not create campaign group');
    } finally {
      setSaving(false);
    }
  }

  function openMemberEditor() {
    if (!selectedGroup) return;
    setSelectedCampaignIds(selectedGroup.campaigns.map((campaign) => campaign.id));
    setEditorOpen(true);
  }

  async function saveMembers() {
    if (!selectedGroup) return;
    setSaving(true);
    setError('');
    try {
      const selectedSet = new Set(selectedCampaignIds);
      const response = await apiFetch(`/campaign-groups/${selectedGroup.id}/members`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          campaigns: campaigns
            .filter((campaign) => selectedSet.has(campaign.id))
            .map((campaign) => ({ id: campaign.id, name: campaign.name })),
        }),
      });
      const body = await parseJsonSafe(response);
      if (!response.ok) throw new Error(extractApiError(body, 'Could not save campaign group'));
      setGroups((body as CampaignGroupResponse).groups);
      setEditorOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save campaign group');
    } finally {
      setSaving(false);
    }
  }

  async function renameGroup() {
    if (!selectedGroup) return;
    const name = window.prompt('Campaign group name', selectedGroup.name)?.trim();
    if (!name || name === selectedGroup.name) return;
    setSaving(true);
    setError('');
    try {
      const response = await apiFetch(`/campaign-groups/${selectedGroup.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, name }),
      });
      const body = await parseJsonSafe(response);
      if (!response.ok) throw new Error(extractApiError(body, 'Could not rename campaign group'));
      await loadGroups();
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : 'Could not rename campaign group');
    } finally {
      setSaving(false);
    }
  }

  async function deleteGroup() {
    if (!selectedGroup || !window.confirm(`Delete group "${selectedGroup.name}"?`)) return;
    setSaving(true);
    setError('');
    try {
      const response = await apiFetch(
        `/campaign-groups/${selectedGroup.id}?${new URLSearchParams({ customerId })}`,
        { method: 'DELETE' },
      );
      const body = await parseJsonSafe(response);
      if (!response.ok) throw new Error(extractApiError(body, 'Could not delete campaign group'));
      setSelectedGroupId('');
      onFilterChange(null);
      await loadGroups();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete campaign group');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="campaignGroupsPanel">
      <div className="campaignGroupsHeader">
        <div>
          <h2>Campaign groups</h2>
          <p>Organize campaigns into custom reporting groups.</p>
        </div>
        <button className="secondaryButton" type="button" onClick={() => setCreateOpen(true)}>
          <FolderPlus size={16} />
          New group
        </button>
      </div>

      <div className="campaignGroupTabs">
        <button
          type="button"
          className={!selectedGroupId ? 'active' : ''}
          onClick={() => setSelectedGroupId('')}
        >
          <Folder size={15} />
          All campaigns
          <span>{campaigns.length}</span>
        </button>
        {groups.map((group) => (
          <button
            key={group.id}
            type="button"
            className={selectedGroupId === group.id ? 'active' : ''}
            onClick={() => setSelectedGroupId(group.id)}
          >
            <i style={{ background: group.color }} />
            {group.name}
            <span>{group.campaigns.length}</span>
          </button>
        ))}
        {loading ? <span className="campaignGroupsLoading">Loading groups...</span> : null}
      </div>

      {selectedGroup ? (
        <div className="campaignGroupSummary">
          <div className="groupIdentity">
            <i style={{ background: selectedGroup.color }} />
            <div>
              <strong>{selectedGroup.name}</strong>
              <span>{selectedGroup.campaigns.length} campaigns saved</span>
            </div>
          </div>
          <div className="groupMetric"><span>Views</span><strong>{formatNumber(metrics.impressions)}</strong></div>
          <div className="groupMetric"><span>Cost</span><strong>{formatNumber(metrics.cost)}</strong></div>
          <div className="groupMetric"><span>CTR</span><strong>{formatPercent(metrics.ctr)}</strong></div>
          <div className="groupMetric"><span>ROAS</span><strong>{metrics.roas.toFixed(2)}</strong></div>
          <div className="groupActions">
            <button className="secondaryButton" type="button" onClick={openMemberEditor}>
              <Users size={15} />
              Manage campaigns
            </button>
            <button className="iconButton" type="button" onClick={renameGroup} title="Rename group">
              <Pencil size={16} />
            </button>
            <button className="iconButton dangerIcon" type="button" onClick={deleteGroup} title="Delete group">
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ) : null}

      {error ? <div className="inlineError">{error}</div> : null}

      {createOpen ? (
        <div className="groupDialogBackdrop">
          <div className="groupDialog" role="dialog" aria-modal="true" aria-label="Create campaign group">
            <div className="groupDialogHeader">
              <div><strong>Create campaign group</strong><span>You can add campaigns after creating it.</span></div>
              <button className="iconButton" type="button" onClick={() => setCreateOpen(false)}><X size={18} /></button>
            </div>
            <label className="groupNameField">
              <span>Group name</span>
              <input value={groupName} onChange={(event) => setGroupName(event.target.value)} autoFocus maxLength={120} />
            </label>
            <div className="colorSwatches" aria-label="Group color">
              {GROUP_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={groupColor === color ? 'active' : ''}
                  style={{ background: color }}
                  onClick={() => setGroupColor(color)}
                  aria-label={`Use color ${color}`}
                >
                  {groupColor === color ? <Check size={14} /> : null}
                </button>
              ))}
            </div>
            <div className="groupDialogFooter">
              <button className="secondaryButton" type="button" onClick={() => setCreateOpen(false)}>Cancel</button>
              <button className="primaryButton" type="button" onClick={createGroup} disabled={saving}>
                <FolderPlus size={15} />
                {saving ? 'Creating...' : 'Create group'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editorOpen && selectedGroup ? (
        <div className="groupDialogBackdrop">
          <div className="groupDialog campaignPicker" role="dialog" aria-modal="true" aria-label="Manage campaigns">
            <div className="groupDialogHeader">
              <div>
                <strong>Manage {selectedGroup.name}</strong>
                <span>{selectedCampaignIds.length}/{campaigns.length} selected</span>
              </div>
              <button className="iconButton" type="button" onClick={() => setEditorOpen(false)}><X size={18} /></button>
            </div>
            <div className="campaignPickerToolbar">
              <button type="button" onClick={() => setSelectedCampaignIds(campaigns.map((campaign) => campaign.id))}>Select all</button>
              <button type="button" onClick={() => setSelectedCampaignIds([])}>Clear</button>
            </div>
            <div className="campaignChecklist">
              {campaigns.map((campaign) => {
                const checked = selectedCampaignIds.includes(campaign.id);
                return (
                  <label key={campaign.id}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setSelectedCampaignIds((current) =>
                        checked
                          ? current.filter((id) => id !== campaign.id)
                          : [...current, campaign.id],
                      )}
                    />
                    <span><strong>{campaign.name}</strong><small>{campaign.id}</small></span>
                    <em>{formatNumber(campaign.impressions)} views</em>
                  </label>
                );
              })}
            </div>
            <div className="groupDialogFooter">
              <button className="secondaryButton" type="button" onClick={() => setEditorOpen(false)}>Cancel</button>
              <button className="primaryButton" type="button" onClick={saveMembers} disabled={saving}>
                <Check size={15} />
                {saving ? 'Saving...' : 'Save campaigns'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
