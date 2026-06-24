import { Entity, PrimaryColumn } from 'typeorm';
import { DailyMetricEntity } from './daily-metric.entity';

@Entity({ name: 'ad_group_daily_metrics' })
export class AdGroupDailyMetricEntity extends DailyMetricEntity {
  @PrimaryColumn({ name: 'ad_group_id', type: 'uuid' })
  adGroupId!: string;
}
