import { Card, Input, Label, ListBox, Select, Tabs, TextArea, TextField } from '@heroui/react'
import { completionPercent, formatDelta, parseNumber, type Unit } from '@lekafit/shared'
import type { ReactNode } from 'react'
import { plainNumber } from '../lib/format'

export const Section = ({
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

export const Icon = ({ children }: { children: ReactNode }) => (
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

export const TABS = [
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

export const Row = ({ children }: { children: ReactNode }) => (
  <div className="grid grid-cols-4 items-center gap-2">{children}</div>
)

export const GridHead = ({ columns }: { columns: [string, string, string, string] }) => (
  <Row>
    {columns.map((c) => (
      <Card.Description key={c} aria-hidden="true" className={'text-center'}>
        {c}
      </Card.Description>
    ))}
  </Row>
)

export const MetricName = ({ label, unit }: { label: string; unit: string }) => (
  <div>
    <Label>{label}</Label>
    <Card.Description>{unit}</Card.Description>
  </div>
)

export const NumberInput = ({
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

export const Value = ({ label, children }: { label: string; children: ReactNode }) => (
  <output aria-label={label} className={'text-center'}>
    {children}
  </output>
)

export const Stat = ({ label, value }: { label: string; value: string }) => (
  <Card variant="transparent">
    <Card.Description className={'text-center'}>{label}</Card.Description>
    <Card.Title className={'text-center'}>
      <Value label={label}>{value}</Value>
    </Card.Title>
  </Card>
)

type Metric<K extends string> = { key: K; label: string; unit: Unit; scope: string }

export const PlanFactRows = <K extends string>({
  metrics,
  completion,
  plan,
  fact,
  coachPlan,
  readOnly,
  isInvalid,
  onPlan,
  onFact,
}: {
  metrics: readonly Metric<K>[]
  completion: readonly { key: K; label: string }[]
  plan: Record<K, string>
  fact: Record<K, string>
  coachPlan: (key: K) => number | null
  readOnly: boolean
  isInvalid: (path: string) => boolean
  onPlan: (key: K, value: string) => void
  onFact: (key: K, value: string) => void
}) => {
  const planValue = (key: K) => coachPlan(key) ?? parseNumber(plan[key])
  return (
    <>
      <GridHead columns={['Показатель', 'План', 'Факт', 'Разница']} />
      {metrics.map((m) => (
        <Row key={m.key}>
          <MetricName label={m.label} unit={`${m.unit} / ${m.scope}`} />
          {coachPlan(m.key) === null ? (
            <NumberInput
              label={`План ${m.label}`}
              value={plan[m.key]}
              disabled={readOnly}
              invalid={false}
              onChange={(v) => onPlan(m.key, v)}
            />
          ) : (
            <Value label={`План ${m.label}`}>{plainNumber(coachPlan(m.key))}</Value>
          )}
          <NumberInput
            label={`Факт ${m.label}`}
            value={fact[m.key]}
            disabled={readOnly}
            invalid={isInvalid(`fact.${m.key}`)}
            onChange={(v) => onFact(m.key, v)}
          />
          <Value label={`Разница ${m.label}`}>
            {formatDelta({ from: planValue(m.key), to: parseNumber(fact[m.key]), unit: m.unit })}
          </Value>
        </Row>
      ))}
      <div className="grid grid-cols-2 gap-2">
        {completion.map((c) => (
          <Stat
            key={c.key}
            label={c.label}
            value={completionPercent({ plan: planValue(c.key), fact: parseNumber(fact[c.key]) })}
          />
        ))}
      </div>
    </>
  )
}

export const ChoiceField = <O extends string>({
  label,
  options,
  value,
  readOnly,
  invalid,
  onChange,
}: {
  label: string
  options: readonly O[]
  value: O | ''
  readOnly: boolean
  invalid: boolean
  onChange: (value: O | '') => void
}) => (
  <Select
    placeholder="Выбрать"
    isDisabled={readOnly}
    isInvalid={invalid}
    selectedKey={value || null}
    onSelectionChange={(key) => onChange(options.find((o) => o === key) ?? '')}
  >
    <Label>{label}</Label>
    <Select.Trigger>
      <Select.Value />
      <Select.Indicator />
    </Select.Trigger>
    <Select.Popover>
      <ListBox>
        {options.map((o) => (
          <ListBox.Item key={o} id={o} textValue={o}>
            {o}
          </ListBox.Item>
        ))}
      </ListBox>
    </Select.Popover>
  </Select>
)

export const WellbeingFields = <K extends string>({
  items,
  values,
  note,
  readOnly,
  isInvalid,
  onChange,
  onNote,
}: {
  items: readonly { key: K; label: string; options: readonly string[] }[]
  values: Record<K, string>
  note: string
  readOnly: boolean
  isInvalid: (path: string) => boolean
  onChange: (key: K, value: string) => void
  onNote: (note: string) => void
}) => (
  <div className="flex flex-col gap-3">
    {items.map((w) => (
      <ChoiceField
        key={w.key}
        label={w.label}
        options={w.options}
        value={values[w.key]}
        readOnly={readOnly}
        invalid={isInvalid(`wellbeing.${w.key}`)}
        onChange={(v) => onChange(w.key, v)}
      />
    ))}
    <TextField value={note} isDisabled={readOnly} onChange={onNote}>
      <Label>Комментарии по самочувствию</Label>
      <TextArea />
    </TextField>
  </div>
)

export const FeedbackFields = <K extends string>({
  items,
  values,
  readOnly,
  isInvalid,
  onChange,
}: {
  items: readonly { key: K; label: string }[]
  values: Record<K, string>
  readOnly: boolean
  isInvalid: (path: string) => boolean
  onChange: (key: K, value: string) => void
}) => (
  <div className="flex flex-col gap-3">
    {items.map((f) => (
      <TextField
        key={f.key}
        value={values[f.key]}
        isDisabled={readOnly}
        isInvalid={isInvalid(`feedback.${f.key}`)}
        onChange={(v) => onChange(f.key, v)}
      >
        <Label>{f.label}</Label>
        <TextArea />
      </TextField>
    ))}
  </div>
)

export type ExtraTab = { id: string; label: string; icon: ReactNode; panel: ReactNode }

export const ReportTabs = ({
  panels,
  extra = [],
}: {
  panels: Record<(typeof TABS)[number]['id'], ReactNode>
  extra?: readonly ExtraTab[]
}) => {
  const tabs = [...TABS.map((t) => ({ ...t, panel: panels[t.id] })), ...extra]
  return (
    <Tabs className="w-full">
      <Tabs.ListContainer>
        <Tabs.List aria-label="Разделы отчёта">
          {tabs.map((t) => (
            <Tabs.Tab key={t.id} id={t.id} aria-label={t.label}>
              <Icon>{t.icon}</Icon>
              <Tabs.Indicator />
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs.ListContainer>
      {tabs.map((t) => (
        <Tabs.Panel key={t.id} className="p-0" id={t.id}>
          {t.panel}
        </Tabs.Panel>
      ))}
    </Tabs>
  )
}
