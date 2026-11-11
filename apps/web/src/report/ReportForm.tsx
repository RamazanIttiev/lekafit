import { Card, TextArea } from '@heroui/react'
import {
  completionPercent,
  FEEDBACK,
  formatDelta,
  MEASURES,
  METRICS,
  type Plan,
  parseNumber,
  type ReportData,
  WELLBEING,
} from '@lekafit/shared'
import type { ReactNode } from 'react'
import { plainNumber } from '../format'

type Props = {
  data: ReportData
  plan: Plan | null
  readOnly: boolean
  onChange: (data: ReportData) => void
}

const Section = ({
  index,
  title,
  hint,
  children,
}: {
  index: string
  title: string
  hint: string
  children: ReactNode
}) => (
  <Card className="section">
    <Card.Header className="flex flex-row items-center gap-3">
      <span className="section-index">{index}</span>
      <div>
        <Card.Title className="section-title">{title}</Card.Title>
        <Card.Description className="text-xs text-muted">{hint}</Card.Description>
      </div>
    </Card.Header>
    <Card.Content>{children}</Card.Content>
  </Card>
)

const GridHead = ({ columns }: { columns: [string, string, string, string] }) => (
  <div className="grid-row grid-head" aria-hidden="true">
    {columns.map((c) => (
      <span key={c}>{c}</span>
    ))}
  </div>
)

const NumberInput = ({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string
  value: string
  disabled: boolean
  onChange: (value: string) => void
}) => (
  <input
    className="num-input"
    aria-label={label}
    inputMode="decimal"
    placeholder="—"
    value={value}
    disabled={disabled}
    onChange={(e) => onChange(e.target.value)}
  />
)

const Delta = ({ label, value }: { label: string; value: string }) => (
  <output aria-label={label} className={value === '—' ? 'delta empty' : 'delta'}>
    {value}
  </output>
)

export const ReportForm = ({ data, plan, readOnly, onChange }: Props) => {
  const set = <K extends keyof ReportData>(section: K, patch: Partial<ReportData[K]>) =>
    onChange({ ...data, [section]: { ...data[section], ...patch } })

  const planValue = (key: (typeof METRICS)[number]['key']) => plan?.[key] ?? null

  return (
    <div className="flex flex-col gap-3">
      <Section
        index="01"
        title="Питание и активность"
        hint="Среднее за 7 дней из FatSecret и приложения шагов. Тренировки — количество за неделю."
      >
        {plan === null && <p className="notice">Тренер ещё не задал план</p>}
        <GridHead columns={['Показатель', 'План', 'Факт', 'Разница']} />
        {METRICS.map((m) => (
          <div className="grid-row" key={m.key}>
            <div className="metric-name">
              {m.label}
              <small>
                {m.unit} / {m.scope}
              </small>
            </div>
            <output aria-label={`План ${m.label}`} className="plan-cell">
              {plainNumber(planValue(m.key))}
            </output>
            <NumberInput
              label={`Факт ${m.label}`}
              value={data.fact[m.key]}
              disabled={readOnly}
              onChange={(v) => set('fact', { [m.key]: v })}
            />
            <Delta
              label={`Разница ${m.label}`}
              value={formatDelta({
                from: planValue(m.key),
                to: parseNumber(data.fact[m.key]),
                unit: m.unit,
              })}
            />
          </div>
        ))}
        <div className="stats">
          <div className="stat">
            <span>Выполнение тренировок</span>
            <output aria-label="Выполнение тренировок">
              {completionPercent({
                plan: planValue('training'),
                fact: parseNumber(data.fact.training),
              })}
            </output>
          </div>
          <div className="stat">
            <span>Средние шаги</span>
            <output aria-label="Средние шаги">
              {completionPercent({ plan: planValue('steps'), fact: parseNumber(data.fact.steps) })}
            </output>
          </div>
        </div>
      </Section>

      <Section
        index="02"
        title="Замеры"
        hint="Заполняйте то, что измеряли. Остальное можно оставить пустым."
      >
        <GridHead columns={['Показатель', 'Было', 'Стало', 'Разница']} />
        {MEASURES.map((m) => (
          <div className="grid-row" key={m.key}>
            <div className="metric-name">
              {m.label}
              <small>{m.unit}</small>
            </div>
            <NumberInput
              label={`Было ${m.label}`}
              value={data.prev[m.key]}
              disabled={readOnly}
              onChange={(v) => set('prev', { [m.key]: v })}
            />
            <NumberInput
              label={`Стало ${m.label}`}
              value={data.now[m.key]}
              disabled={readOnly}
              onChange={(v) => set('now', { [m.key]: v })}
            />
            <Delta
              label={`Разница ${m.label}`}
              value={formatDelta({
                from: parseNumber(data.prev[m.key]),
                to: parseNumber(data.now[m.key]),
                unit: m.unit,
              })}
            />
          </div>
        ))}
      </Section>

      <Section index="03" title="Самочувствие" hint="Средняя оценка за последние 7 дней">
        <div className="flex flex-col gap-3">
          {WELLBEING.map((w) => (
            <label className="field" key={w.key}>
              <span>{w.label}</span>
              <select
                aria-label={w.label}
                className="select"
                value={data.wellbeing[w.key]}
                disabled={readOnly}
                onChange={(e) => set('wellbeing', { [w.key]: e.target.value })}
              >
                <option value="">Выбрать</option>
                {w.options.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
          ))}
          <div className="field">
            <span aria-hidden="true">Комментарии по самочувствию</span>
            <TextArea
              aria-label="Комментарии по самочувствию"
              value={data.wellbeing.note}
              disabled={readOnly}
              placeholder="Только если есть что уточнить…"
              onChange={(e) => set('wellbeing', { note: e.target.value })}
            />
          </div>
        </div>
      </Section>

      <Section index="04" title="Обратная связь" hint="Коротко, своими словами">
        <div className="flex flex-col gap-3">
          {FEEDBACK.map((f) => (
            <div className="field" key={f.key}>
              <span aria-hidden="true">{f.label}</span>
              <TextArea
                aria-label={f.label}
                value={data.feedback[f.key]}
                disabled={readOnly}
                onChange={(e) => set('feedback', { [f.key]: e.target.value })}
              />
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}
