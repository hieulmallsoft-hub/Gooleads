import { Column, Entity } from 'typeorm';
import { UuidTimestampEntity } from './base.entity';

@Entity({ name: 'automation_schedules' })
export class AutomationScheduleEntity extends UuidTimestampEntity {
  @Column({ name: 'policy_id', type: 'uuid' }) policyId!: string;
  @Column({ type: 'varchar', length: 100 }) timezone!: string;
  @Column({ name: 'interval_days', type: 'smallint' }) intervalDays!: number;
  @Column({ type: 'boolean' }) enabled!: boolean;
  @Column({ name: 'last_run_at', type: 'timestamptz', nullable: true }) lastRunAt!: Date | null;
  @Column({ name: 'next_run_at', type: 'timestamptz', nullable: true }) nextRunAt!: Date | null;
}
