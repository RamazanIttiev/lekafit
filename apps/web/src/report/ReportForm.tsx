import { Alert, Card, Input, Label, ListBox, Select, TextArea, TextField } from '@heroui/react'
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
  title,
  hint,
  children,
}: {
  title: string
  hint: string
  children: ReactNode
}) => (
  <Card>
    <Card.Header>
      <Card.Title>{title}</Card.Title>
      <Card.Description>{hint}</Card.Description>
    </Card.Header>
    <Card.Content>{children}</Card.Content>
  </Card>
)

const Row = ({ children }: { children: ReactNode }) => (
  <div className="grid grid-cols-4 items-center gap-2">{children}</div>
)

const GridHead = ({ columns }: { columns: [string, string, string, string] }) => (
  <Row>
    {columns.map((c) => (
      <Card.Description key={c} aria-hidden="true">
        {c}
      </Card.Description>
    ))}
  </Row>
)

const MetricName = ({ label, unit }: { label: string; unit: string }) => (
  <div>
    <Label>{label}</Label>
    <Card.Description>{unit}</Card.Description>
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
  <TextField aria-label={label} value={value} isDisabled={disabled} onChange={onChange}>
    <Input inputMode="decimal" placeholder="—" />
  </TextField>
)

const Value = ({ label, children }: { label: string; children: ReactNode }) => (
  <output aria-label={label}>{children}</output>
)

const Stat = ({ label, value }: { label: string; value: string }) => (
  <Card variant="secondary">
    <Card.Description>{label}</Card.Description>
    <Card.Title>
      <Value label={label}>{value}</Value>
    </Card.Title>
  </Card>
)

export const ReportForm = ({ data, plan, readOnly, onChange }: Props) => {
  const set = <K extends keyof ReportData>(section: K, patch: Partial<ReportData[K]>) =>
    onChange({ ...data, [section]: { ...data[section], ...patch } })

  const planValue = (key: (typeof METRICS)[number]['key']) => plan?.[key] ?? null

  return (
    <div className="flex flex-col gap-3">
      <Section
        title="Питание и активность"
        hint="Среднее за 7 дней из FatSecret и приложения шагов. Тренировки — количество за неделю."
      >
        <div className="flex flex-col gap-3">
          {plan === null && (
            <Alert>
              <Alert.Content>
                <Alert.Title>Тренер ещё не задал план</Alert.Title>
              </Alert.Content>
            </Alert>
          )}
          <GridHead columns={['Показатель', 'План', 'Факт', 'Разница']} />
          {METRICS.map((m) => (
            <Row key={m.key}>
              <MetricName label={m.label} unit={`${m.unit} / ${m.scope}`} />
              <Value label={`План ${m.label}`}>{plainNumber(planValue(m.key))}</Value>
              <NumberInput
                label={`Факт ${m.label}`}
                value={data.fact[m.key]}
                disabled={readOnly}
                onChange={(v) => set('fact', { [m.key]: v })}
              />
              <Value label={`Разница ${m.label}`}>
                {formatDelta({
                  from: planValue(m.key),
                  to: parseNumber(data.fact[m.key]),
                  unit: m.unit,
                })}
              </Value>
            </Row>
          ))}
          <div className="grid grid-cols-2 gap-2">
            <Stat
              label="Выполнение тренировок"
              value={completionPercent({
                plan: planValue('training'),
                fact: parseNumber(data.fact.training),
              })}
            />
            <Stat
              label="Средние шаги"
              value={completionPercent({
                plan: planValue('steps'),
                fact: parseNumber(data.fact.steps),
              })}
            />
          </div>
        </div>
      </Section>

      <Section title="Замеры" hint="Заполняйте то, что измеряли. Остальное можно оставить пустым.">
        <div className="flex flex-col gap-3">
          <GridHead columns={['Показатель', 'Было', 'Стало', 'Разница']} />
          {MEASURES.map((m) => (
            <Row key={m.key}>
              <MetricName label={m.label} unit={m.unit} />
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
              <Value label={`Разница ${m.label}`}>
                {formatDelta({
                  from: parseNumber(data.prev[m.key]),
                  to: parseNumber(data.now[m.key]),
                  unit: m.unit,
                })}
              </Value>
            </Row>
          ))}
        </div>
      </Section>

      <Section title="Самочувствие" hint="Средняя оценка за последние 7 дней">
        <div className="flex flex-col gap-3">
          {WELLBEING.map((w) => (
            <Select
              key={w.key}
              placeholder="Выбрать"
              isDisabled={readOnly}
              selectedKey={data.wellbeing[w.key] || null}
              onSelectionChange={(key) => set('wellbeing', { [w.key]: key ? String(key) : '' })}
            >
              <Label>{w.label}</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {w.options.map((o) => (
                    <ListBox.Item key={o} id={o} textValue={o}>
                      {o}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          ))}
          <TextField
            value={data.wellbeing.note}
            isDisabled={readOnly}
            onChange={(note) => set('wellbeing', { note })}
          >
            <Label>Комментарии по самочувствию</Label>
            <TextArea placeholder="Только если есть что уточнить…" />
          </TextField>
        </div>
      </Section>

      <Section title="Обратная связь" hint="Коротко, своими словами">
        <div className="flex flex-col gap-3">
          {FEEDBACK.map((f) => (
            <TextField
              key={f.key}
              value={data.feedback[f.key]}
              isDisabled={readOnly}
              onChange={(v) => set('feedback', { [f.key]: v })}
            >
              <Label>{f.label}</Label>
              <TextArea />
            </TextField>
          ))}
        </div>
      </Section>
    </div>
  )
}
