import { Entity, PrimaryColumn } from 'typeorm';
import { DailyMetricEntity } from './daily-metric.entity';

@Entity({ name: 'campaign_daily_metrics' })
export class CampaignDailyMetricEntity extends DailyMetricEntity {
  @PrimaryColumn({ name: 'campaign_id', type: 'uuid' })
  campaignId!: string;
}
