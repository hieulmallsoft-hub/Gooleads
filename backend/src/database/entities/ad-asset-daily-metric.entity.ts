import { Column, Entity, PrimaryColumn } from 'typeorm';
import { DailyMetricEntity } from './daily-metric.entity';

@Entity({ name: 'ad_asset_daily_metrics' })
export class AdAssetDailyMetricEntity extends DailyMetricEntity {
  @PrimaryColumn({ name: 'ad_asset_link_id', type: 'uuid' })
  adAssetLinkId!: string;

  @Column({ name: 'performance_label', type: 'varchar', length: 30 })
  performanceLabel!: string;
}
