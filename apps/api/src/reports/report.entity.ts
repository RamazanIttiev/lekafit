import type { Plan } from '@lekafit/shared'
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

export type ReportStatus = 'DRAFT' | 'SUBMITTED'

@Entity('reports')
@Unique('reports_user_week', ['userId', 'weekStart'])
export class ReportEntity {
  @PrimaryGeneratedColumn({ type: 'int' })
  id!: number

  @Column({ name: 'user_id', type: 'int' })
  userId!: number

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: UserEntity

  @Column({ name: 'week_start', type: 'date' })
  weekStart!: string

  @Column({ name: 'week_end', type: 'date' })
  weekEnd!: string

  @Column({ type: 'varchar', length: 10, default: 'DRAFT' })
  status!: ReportStatus

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
