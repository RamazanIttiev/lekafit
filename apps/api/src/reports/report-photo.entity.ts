import type { PhotoAngle } from '@lekafit/shared'
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm'
import { ReportEntity } from './report.entity'

@Entity('report_photos')
@Unique('report_photos_report_angle', ['reportId', 'angle'])
export class ReportPhotoEntity {
  @PrimaryGeneratedColumn({ type: 'int' })
  id!: number

  @Column({ name: 'report_id', type: 'int' })
  reportId!: number

  @ManyToOne(() => ReportEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'report_id' })
  report?: ReportEntity

  @Column({ type: 'varchar', length: 10 })
  angle!: PhotoAngle

  @Column({ type: 'varchar', length: 20 })
  mime!: string

  @Column({ type: 'bytea' })
  data!: Buffer

  @CreateDateColumn({ name: 'uploaded_at', type: 'timestamptz' })
  uploadedAt!: Date
}
