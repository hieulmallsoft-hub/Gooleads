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
const SELECTED_GROUP_STORAGE_PREFIX = 'ggads:selected-campaign-group:';
const ALL_CAMPAIGNS_GROUP_ID = '__all__';

export type CampaignGroupSelection = {
  id: string;
  name: string;
  campaignIds: string[];
};

type CampaignGroupsPanelProps = {
  customerId: string;
  campaigns: Campaign[];
  canEdit: boolean;
  onFilterChange: (selection: CampaignGroupSelection | null) => void;
};

function getSelectedGroupStorageKey(customerId: string) {
  return `${SELECTED_GROUP_STORAGE_PREFIX}${customerId}`;
}

function readStoredGroupId(customerId: string) {
  try {
    return window.localStorage.getItem(getSelectedGroupStorageKey(customerId)) ?? '';
  } catch {
    return '';
  }
}

function writeStoredGroupId(customerId: string, groupId: string) {
  try {
    const storageKey = getSelectedGroupStorageKey(customerId);
    if (groupId) {
      window.localStorage.setItem(storageKey, groupId);
    } else {
      window.localStorage.removeItem(storageKey);
    }
  } catch {
    // The selected group still works for the current session.
  }
}

export function CampaignGroupsPanel({
  customerId,
  campaigns,
  canEdit,
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
      if (!response.ok) throw new Error(extractApiError(body, 'Không thể tải nhóm chiến dịch'));
      const result = body as CampaignGroupResponse;
      const storedGroupId = readStoredGroupId(customerId);
      setGroups(result.groups);
      setSelectedGroupId((current) => {
        const groupIds = new Set(result.groups.map((group) => group.id));
        if (current && groupIds.has(current)) return current;
        if (storedGroupId === ALL_CAMPAIGNS_GROUP_ID) return '';
        if (storedGroupId && groupIds.has(storedGroupId)) return storedGroupId;
        if (result.groups.length === 1) return result.groups[0].id;
        return '';
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không thể tải nhóm chiến dịch');
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
    if (!selectedGroup) {
      onFilterChange(null);
      return;
    }

    writeStoredGroupId(customerId, selectedGroup.id);
    onFilterChange({
      id: selectedGroup.id,
      name: selectedGroup.name,
      campaignIds: selectedGroup.campaigns.map((campaign) => campaign.id),
    });
  }, [customerId, selectedGroup]);

  async function createGroup() {
    if (!canEdit) {
      setError('Bạn chỉ có quyền xem nhóm chiến dịch');
      return;
    }
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
      if (!response.ok) throw new Error(extractApiError(body, 'Không thể tạo nhóm chiến dịch'));
      setGroupName('');
      setCreateOpen(false);
      await loadGroups();
      setSelectedGroupId(body.id);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Không thể tạo nhóm chiến dịch');
    } finally {
      setSaving(false);
    }
  }

  function openMemberEditor() {
    if (!canEdit) return;
    if (!selectedGroup) return;
    setSelectedCampaignIds(selectedGroup.campaigns.map((campaign) => campaign.id));
    setEditorOpen(true);
  }

  async function saveMembers() {
    if (!canEdit) {
      setError('Bạn chỉ có quyền xem nhóm chiến dịch');
      return;
    }
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
      if (!response.ok) throw new Error(extractApiError(body, 'Không thể lưu nhóm chiến dịch'));
      setGroups((body as CampaignGroupResponse).groups);
      setEditorOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không thể lưu nhóm chiến dịch');
    } finally {
      setSaving(false);
    }
  }

  async function renameGroup() {
    if (!canEdit) {
      setError('Bạn chỉ có quyền xem nhóm chiến dịch');
      return;
    }
    if (!selectedGroup) return;
    const name = window.prompt('Tên nhóm chiến dịch', selectedGroup.name)?.trim();
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
      if (!response.ok) throw new Error(extractApiError(body, 'Không thể đổi tên nhóm chiến dịch'));
      await loadGroups();
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : 'Không thể đổi tên nhóm chiến dịch');
    } finally {
      setSaving(false);
    }
  }

  async function deleteGroup() {
    if (!canEdit) {
      setError('Bạn chỉ có quyền xem nhóm chiến dịch');
      return;
    }
    if (!selectedGroup || !window.confirm(`Xóa nhóm "${selectedGroup.name}"?`)) return;
    setSaving(true);
    setError('');
    try {
      const response = await apiFetch(
        `/campaign-groups/${selectedGroup.id}?${new URLSearchParams({ customerId })}`,
        { method: 'DELETE' },
      );
      const body = await parseJsonSafe(response);
      if (!response.ok) throw new Error(extractApiError(body, 'Không thể xóa nhóm chiến dịch'));
      writeStoredGroupId(customerId, '');
      setSelectedGroupId('');
      onFilterChange(null);
      await loadGroups();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Không thể xóa nhóm chiến dịch');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="campaignGroupsPanel">
      <div className="campaignGroupsHeader">
        <div>
          <h2>Nhóm chiến dịch</h2>
          <p>Sắp xếp chiến dịch thành các nhóm báo cáo tùy chỉnh.</p>
        </div>
        <button className="secondaryButton" type="button" onClick={() => setCreateOpen(true)} disabled={!canEdit}>
          <FolderPlus size={16} />
          New group
        </button>
      </div>

      <div className="campaignGroupTabs">
        <button
          type="button"
          className={!selectedGroupId ? 'active' : ''}
          onClick={() => {
            writeStoredGroupId(customerId, ALL_CAMPAIGNS_GROUP_ID);
            setSelectedGroupId('');
          }}
        >
          <Folder size={15} />
          Tất cả chiến dịch
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
        {loading ? <span className="campaignGroupsLoading">Đang tải nhóm...</span> : null}
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
          <div className="groupMetric"><span>Lượt hiển thị</span><strong>{formatNumber(metrics.impressions)}</strong></div>
          <div className="groupMetric"><span>Chi phí</span><strong>{formatNumber(metrics.cost)}</strong></div>
          <div className="groupMetric"><span>CTR</span><strong>{formatPercent(metrics.ctr)}</strong></div>
          <div className="groupMetric"><span>Giá trị CĐ / chi phí</span><strong>{formatPercent(metrics.roas)}</strong></div>
          <div className="groupActions">
            <button className="secondaryButton" type="button" onClick={openMemberEditor} disabled={!canEdit}>
              <Users size={15} />
              Manage campaigns
            </button>
            <button className="iconButton" type="button" onClick={renameGroup} title="Rename group" disabled={!canEdit}>
              <Pencil size={16} />
            </button>
            <button className="iconButton dangerIcon" type="button" onClick={deleteGroup} title="Xóa nhóm" disabled={!canEdit}>
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ) : null}

      {error ? <div className="inlineError">{error}</div> : null}

      {createOpen ? (
        <div className="groupDialogBackdrop">
          <div className="groupDialog" role="dialog" aria-modal="true" aria-label="Tạo nhóm chiến dịch">
            <div className="groupDialogHeader">
              <div><strong>Tạo nhóm chiến dịch</strong><span>Bạn có thể thêm chiến dịch sau khi tạo nhóm.</span></div>
              <button className="iconButton" type="button" onClick={() => setCreateOpen(false)}><X size={18} /></button>
            </div>
            <label className="groupNameField">
              <span>Tên nhóm</span>
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
              <button className="secondaryButton" type="button" onClick={() => setCreateOpen(false)}>Hủy</button>
              <button className="primaryButton" type="button" onClick={createGroup} disabled={saving}>
                <FolderPlus size={15} />
                {saving ? 'Đang tạo...' : 'Tạo nhóm'}
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
                <span>Đã chọn {selectedCampaignIds.length}/{campaigns.length}</span>
              </div>
              <button className="iconButton" type="button" onClick={() => setEditorOpen(false)}><X size={18} /></button>
            </div>
            <div className="campaignPickerToolbar">
              <button type="button" onClick={() => setSelectedCampaignIds(campaigns.map((campaign) => campaign.id))}>Chọn tất cả</button>
              <button type="button" onClick={() => setSelectedCampaignIds([])}>Bỏ chọn</button>
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
              <button className="secondaryButton" type="button" onClick={() => setEditorOpen(false)}>Hủy</button>
              <button className="primaryButton" type="button" onClick={saveMembers} disabled={saving}>
                <Check size={15} />
                {saving ? 'Đang lưu...' : 'Lưu chiến dịch'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
