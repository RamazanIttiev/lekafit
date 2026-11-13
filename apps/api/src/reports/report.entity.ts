import type { Plan, ReportKind } from '@lekafit/shared'
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm'
import { UserEntity } from '../users/user.entity'

@Entity('reports')
@Unique('reports_user_kind_period', ['userId', 'kind', 'periodStart', 'periodEnd'])
export class ReportEntity {
  @PrimaryGeneratedColumn({ type: 'int' })
  id!: number

  @Column({ name: 'user_id', type: 'int' })
  userId!: number

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: UserEntity

  @Column({ type: 'varchar', length: 10, default: 'WEEKLY' })
  kind!: ReportKind

  @Column({ name: 'period_start', type: 'date' })
  periodStart!: string

  @Column({ name: 'period_end', type: 'date' })
  periodEnd!: string

  @Column({ type: 'jsonb' })
  data!: unknown

  @Column({ name: 'plan_snapshot', type: 'jsonb', nullable: true })
  planSnapshot!: Plan | null

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt!: Date | null

  @Column({ name: 'seen_by_coach_at', type: 'timestamptz', nullable: true })
  seenByCoachAt!: Date | null

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date
}
