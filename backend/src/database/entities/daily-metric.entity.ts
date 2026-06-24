import { Column, CreateDateColumn, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export abstract class DailyMetricEntity {
  @PrimaryColumn({ name: 'metric_date', type: 'date' })
  metricDate!: string;

  @Column({ name: 'sync_run_id', type: 'uuid', nullable: true })
  syncRunId!: string | null;

  @Column({ type: 'bigint' })
  impressions!: string;

  @Column({ type: 'bigint' })
  clicks!: string;

  @Column({ name: 'cost_micros', type: 'bigint' })
  costMicros!: string;

  @Column({ type: 'numeric', precision: 20, scale: 6 })
  conversions!: string;

  @Column({ name: 'conversion_value', type: 'numeric', precision: 24, scale: 6 })
  conversionValue!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
