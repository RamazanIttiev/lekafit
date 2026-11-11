import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm'

export type Role = 'CLIENT' | 'COACH'

const bigintAsNumber = {
  to: (value: number) => value,
  from: (value: string) => Number(value),
}

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn({ type: 'int' })
  id!: number

  @Column({ name: 'telegram_id', type: 'bigint', unique: true, transformer: bigintAsNumber })
  telegramId!: number

  @Column({ name: 'first_name', type: 'text' })
  firstName!: string

  @Column({ name: 'last_name', type: 'text', nullable: true })
  lastName!: string | null

  @Column({ type: 'text', nullable: true })
  username!: string | null

  @Column({ type: 'varchar', length: 10 })
  role!: Role

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date
}
