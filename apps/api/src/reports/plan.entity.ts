import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm'
import { UserEntity } from '../users/user.entity'

@Entity('plans')
export class PlanEntity {
  @PrimaryColumn({ name: 'user_id', type: 'int' })
  userId!: number

  @OneToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: UserEntity

  @Column({ type: 'double precision', nullable: true })
  cal!: number | null

  @Column({ type: 'double precision', nullable: true })
  protein!: number | null

  @Column({ type: 'double precision', nullable: true })
  fat!: number | null

  @Column({ type: 'double precision', nullable: true })
  carb!: number | null

  @Column({ type: 'double precision', nullable: true })
  steps!: number | null

  @Column({ type: 'double precision', nullable: true })
  training!: number | null

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date
}
