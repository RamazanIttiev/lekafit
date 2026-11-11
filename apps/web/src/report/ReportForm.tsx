import {
  Alert,
  Card,
  Input,
  Label,
  ListBox,
  Select,
  Tabs,
  TextArea,
  TextField,
} from '@heroui/react'
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
  invalid?: ReadonlySet<string>
  onChange: (data: ReportData) => void
}

const Section = ({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: ReactNode
}) => (
  <Card variant={'default'}>
    <Card.Header>
      <Card.Title>{title}</Card.Title>
      <Card.Description>{hint}</Card.Description>
    </Card.Header>
    <Card.Content>{children}</Card.Content>
  </Card>
)

const Icon = ({ children }: { children: ReactNode }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
)

const TABS = [
  {
    id: 'activity',
    label: 'Питание и активность',
    icon: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  },
  {
    id: 'measures',
    label: 'Замеры',
    icon: (
      <>
        <rect x="2" y="7" width="20" height="10" rx="2" />
        <path d="M6 7v4M10 7v3M14 7v4M18 7v3" />
      </>
    ),
  },
  {
    id: 'wellbeing',
    label: 'Самочувствие',
    icon: <path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" />,
  },
  {
    id: 'feedback',
    label: 'Обратная связь',
    icon: <path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z" />,
  },
] as const

const Row = ({ children }: { children: ReactNode }) => (
  <div className="grid grid-cols-4 items-center gap-2">{children}</div>
)

const GridHead = ({ columns }: { columns: [string, string, string, string] }) => (
  <Row>
    {columns.map((c) => (
      <Card.Description key={c} aria-hidden="true" className={'text-center'}>
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
  invalid,
  onChange,
}: {
  label: string
  value: string
  disabled: boolean
  invalid: boolean
  onChange: (value: string) => void
}) => (
  <TextField
    aria-label={label}
    value={value}
    isDisabled={disabled}
    isInvalid={invalid}
    onChange={onChange}
  >
    <Input inputMode="decimal" placeholder="—" className={'text-center'} />
  </TextField>
)

const Value = ({ label, children }: { label: string; children: ReactNode }) => (
  <output aria-label={label} className={'text-center'}>
    {children}
  </output>
)

const Stat = ({ label, value }: { label: string; value: string }) => (
  <Card variant="transparent">
    <Card.Description className={'text-center'}>{label}</Card.Description>
    <Card.Title className={'text-center'}>
      <Value label={label}>{value}</Value>
    </Card.Title>
  </Card>
)

export const ReportForm = ({ data, plan, readOnly, invalid = new Set(), onChange }: Props) => {
  const set = <K extends keyof ReportData>(section: K, patch: Partial<ReportData[K]>) =>
    onChange({ ...data, [section]: { ...data[section], ...patch } })

  const isInvalid = (path: string) => invalid.has(path)

  const planValue = (key: (typeof METRICS)[number]['key']) => plan?.[key] ?? null

  return (
    <Tabs className="w-full">
      <Tabs.ListContainer>
        <Tabs.List aria-label="Разделы отчёта">
          {TABS.map((t) => (
            <Tabs.Tab key={t.id} id={t.id} aria-label={t.label}>
              <Icon>{t.icon}</Icon>
              <Tabs.Indicator />
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs.ListContainer>
      <Tabs.Panel className="p-0" id="activity">
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
                  invalid={isInvalid(`fact.${m.key}`)}
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
                label="Тренировки"
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
      </Tabs.Panel>
      <Tabs.Panel className="p-0" id="measures">
        <Section title="Замеры" hint="Заполните все замеры.">
          <div className="flex flex-col gap-3">
            <GridHead columns={['Показатель', 'Было', 'Стало', 'Разница']} />
            {MEASURES.map((m) => (
              <Row key={m.key}>
                <MetricName label={m.label} unit={m.unit} />
                <Value label={`Было ${m.label}`}>{data.prev[m.key] || '—'}</Value>
                <NumberInput
                  label={`Стало ${m.label}`}
                  value={data.now[m.key]}
                  disabled={readOnly}
                  invalid={isInvalid(`now.${m.key}`)}
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
      </Tabs.Panel>
      <Tabs.Panel className="p-0" id="wellbeing">
        <Section title="Самочувствие" hint="Средняя оценка за последние 7 дней">
          <div className="flex flex-col gap-3">
            {WELLBEING.map((w) => (
              <Select
                key={w.key}
                placeholder="Выбрать"
                isDisabled={readOnly}
                isInvalid={isInvalid(`wellbeing.${w.key}`)}
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
              <TextArea />
            </TextField>
          </div>
        </Section>
      </Tabs.Panel>
      <Tabs.Panel className="p-0" id="feedback">
        <Section title="Обратная связь" hint="Коротко, своими словами">
          <div className="flex flex-col gap-3">
            {FEEDBACK.map((f) => (
              <TextField
                key={f.key}
                value={data.feedback[f.key]}
                isDisabled={readOnly}
                isInvalid={isInvalid(`feedback.${f.key}`)}
                onChange={(v) => set('feedback', { [f.key]: v })}
              >
                <Label>{f.label}</Label>
                <TextArea />
              </TextField>
            ))}
          </div>
        </Section>
      </Tabs.Panel>
    </Tabs>
  )
}
