WITH latest_completed_sync AS (
  SELECT DISTINCT ON (
    account_id,
    metadata ->> 'adGroupId'
  )
    account_id,
    metadata ->> 'adGroupId' AS google_ad_group_id,
    started_at
  FROM sync_runs
  WHERE status = 'COMPLETED'
    AND metadata ->> 'adGroupId' IS NOT NULL
  ORDER BY
    account_id,
    metadata ->> 'adGroupId',
    started_at DESC
)
UPDATE ad_asset_links AS link
SET
  enabled = FALSE,
  updated_at = NOW()
FROM ads AS ad
JOIN ad_groups AS ad_group
  ON ad_group.id = ad.ad_group_id
JOIN campaigns AS campaign
  ON campaign.id = ad_group.campaign_id
JOIN latest_completed_sync AS latest_sync
  ON latest_sync.account_id = campaign.account_id
  AND latest_sync.google_ad_group_id = ad_group.google_ad_group_id
WHERE link.ad_id = ad.id
  AND link.enabled = TRUE
  AND link.last_seen_at < latest_sync.started_at;
