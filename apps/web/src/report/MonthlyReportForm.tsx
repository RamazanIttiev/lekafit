import { Card, Input, Label, TextField } from '@heroui/react'
import {
  formatDelta,
  GOALS,
  MONTHLY_FEEDBACK,
  MONTHLY_MEASURES,
  MONTHLY_METRICS,
  MONTHLY_WELLBEING,
  type Plan,
  parseNumber,
} from '@lekafit/shared'
import { useState } from 'react'
import type { MonthlyReportData } from '../api'
import {
  ChoiceField,
  FeedbackFields,
  GridHead,
  MetricName,
  NumberInput,
  PlanFactRows,
  ReportTabs,
  Row,
  Section,
  Value,
  WellbeingFields,
} from './parts'
import { NoPlanNotice } from './ReportForm'

type Props = {
  data: MonthlyReportData
  plan: Plan | null
  readOnly: boolean
  invalid?: ReadonlySet<string>
  onChange: (data: MonthlyReportData) => void
}

type MetricKey = (typeof MONTHLY_METRICS)[number]['key']

const COMPLETION = [
  { key: 'training', label: 'Тренировки' },
  { key: 'steps', label: 'Средние шаги' },
] as const

const coachPlanFor =
  (plan: Plan | null) =>
  (key: MetricKey): number | null => {
    if (key === 'training') return plan?.trainingMonth ?? null
    if (key === 'cardio') return plan?.cardioMonth ?? null
    return plan?.[key] ?? null
  }

export const MonthlyReportForm = ({
  data,
  plan,
  readOnly,
  invalid = new Set(),
  onChange,
}: Props) => {
  const set = <K extends keyof MonthlyReportData>(
    section: K,
    patch: Partial<MonthlyReportData[K]>,
  ) => onChange({ ...data, [section]: { ...data[section], ...patch } })
  const isInvalid = (path: string) => invalid.has(path)
  const [editablePrev] = useState(
    () =>
      new Set(Object.keys(data.prev).filter((key) => !data.prev[key as keyof typeof data.prev])),
  )
  const hasPrev = (key: string) => !editablePrev.has(key)
  const firstMonth = (key: (typeof MONTHLY_MEASURES)[number]['key']) => !data.prev[key]

  return (
    <ReportTabs
      panels={{
        activity: (
          <div className="flex flex-col gap-3">
            <Section title="Цель">
              <div className="flex flex-col gap-3">
                <ChoiceField
                  label="Основная цель работы"
                  options={GOALS}
                  value={data.about.goal}
                  readOnly={readOnly}
                  invalid={false}
                  onChange={(goal) => set('about', { goal })}
                />
                <TextField
                  value={data.about.startDate}
                  isDisabled={readOnly}
                  onChange={(startDate) => set('about', { startDate })}
                >
                  <Label>Начало сопровождения</Label>
                  <Input type="date" />
                </TextField>
              </div>
            </Section>
            <Section
              title="Питание и активность"
              hint="Среднее за месяц по данным приложений. Тренировки и кардио — итог за месяц, кардио по желанию."
            >
              <div className="flex flex-col gap-3">
                {plan === null && <NoPlanNotice />}
                <PlanFactRows
                  metrics={MONTHLY_METRICS}
                  completion={COMPLETION}
                  plan={data.plan}
                  fact={data.fact}
                  coachPlan={coachPlanFor(plan)}
                  readOnly={readOnly}
                  isInvalid={isInvalid}
                  onPlan={(key, v) => set('plan', { [key]: v })}
                  onFact={(key, v) => set('fact', { [key]: v })}
                />
              </div>
            </Section>
          </div>
        ),
        measures: (
          <Section
            title="Замеры"
            hint="Замеряйте в одинаковых условиях. В первый месяц впишите значения на старте."
          >
            <div className="flex flex-col gap-4">
              <GridHead columns={['Показатель', 'Старт', 'Было', 'Стало']} />
              {MONTHLY_MEASURES.map((m) => (
                <div key={m.key} className="flex flex-col gap-1">
                  <Row>
                    <MetricName label={m.label} unit={m.unit} />
                    {firstMonth(m.key) ? (
                      <NumberInput
                        label={`Старт ${m.label}`}
                        value={data.baseline[m.key]}
                        disabled={readOnly}
                        invalid={false}
                        onChange={(v) => set('baseline', { [m.key]: v })}
                      />
                    ) : (
                      <Value label={`Старт ${m.label}`}>{data.baseline[m.key] || '—'}</Value>
                    )}
                    {hasPrev(m.key) ? (
                      <Value label={`Было ${m.label}`}>{data.prev[m.key]}</Value>
                    ) : (
                      <NumberInput
                        label={`Было ${m.label}`}
                        value={data.prev[m.key]}
                        disabled={readOnly}
                        invalid={false}
                        onChange={(v) => set('prev', { [m.key]: v })}
                      />
                    )}
                    <NumberInput
                      label={`Стало ${m.label}`}
                      value={data.now[m.key]}
                      disabled={readOnly}
                      invalid={isInvalid(`now.${m.key}`)}
                      onChange={(v) => set('now', { [m.key]: v })}
                    />
                  </Row>
                  <Card.Description className="flex justify-end gap-4">
                    <span>
                      За месяц:{' '}
                      <Value label={`За месяц ${m.label}`}>
                        {formatDelta({
                          from: parseNumber(data.prev[m.key]),
                          to: parseNumber(data.now[m.key]),
                          unit: m.unit,
                        })}
                      </Value>
                    </span>
                    <span>
                      От старта:{' '}
                      <Value label={`От старта ${m.label}`}>
                        {formatDelta({
                          from: parseNumber(data.baseline[m.key]),
                          to: parseNumber(data.now[m.key]),
                          unit: m.unit,
                        })}
                      </Value>
                    </span>
                  </Card.Description>
                </div>
              ))}
            </div>
          </Section>
        ),
        wellbeing: (
          <Section title="Самочувствие" hint="Оценка месяца в целом">
            <WellbeingFields
              items={MONTHLY_WELLBEING}
              values={data.wellbeing}
              note={data.wellbeing.note}
              readOnly={readOnly}
              isInvalid={isInvalid}
              onChange={(key, v) => set('wellbeing', { [key]: v })}
              onNote={(note) => set('wellbeing', { note })}
            />
          </Section>
        ),
        feedback: (
          <Section title="Итоги месяца" hint="Коротко и по существу">
            <FeedbackFields
              items={MONTHLY_FEEDBACK}
              values={data.feedback}
              readOnly={readOnly}
              isInvalid={isInvalid}
              onChange={(key, v) => set('feedback', { [key]: v })}
            />
          </Section>
        ),
      }}
    />
  )
}
