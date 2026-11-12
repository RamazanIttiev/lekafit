import { Alert } from '@heroui/react'
import {
  FEEDBACK,
  formatDelta,
  MEASURES,
  METRICS,
  type Plan,
  parseNumber,
  type ReportData,
  WELLBEING,
} from '@lekafit/shared'
import {
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

type Props = {
  data: ReportData
  plan: Plan | null
  readOnly: boolean
  invalid?: ReadonlySet<string>
  onChange: (data: ReportData) => void
}

const COMPLETION = [
  { key: 'training', label: 'Тренировки' },
  { key: 'steps', label: 'Средние шаги' },
] as const

export const NoPlanNotice = () => (
  <Alert>
    <Alert.Content>
      <Alert.Title>Тренер ещё не задал план</Alert.Title>
    </Alert.Content>
  </Alert>
)

export const ReportForm = ({ data, plan, readOnly, invalid = new Set(), onChange }: Props) => {
  const set = <K extends keyof ReportData>(section: K, patch: Partial<ReportData[K]>) =>
    onChange({ ...data, [section]: { ...data[section], ...patch } })
  const isInvalid = (path: string) => invalid.has(path)

  return (
    <ReportTabs
      panels={{
        activity: (
          <Section
            title="Питание и активность"
            hint="Среднее за 7 дней из FatSecret и приложения шагов. Тренировки — количество за неделю."
          >
            <div className="flex flex-col gap-3">
              {plan === null && <NoPlanNotice />}
              <PlanFactRows
                metrics={METRICS}
                completion={COMPLETION}
                plan={data.plan}
                fact={data.fact}
                coachPlan={(key) => plan?.[key] ?? null}
                readOnly={readOnly}
                isInvalid={isInvalid}
                onPlan={(key, v) => set('plan', { [key]: v })}
                onFact={(key, v) => set('fact', { [key]: v })}
              />
            </div>
          </Section>
        ),
        measures: (
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
        ),
        wellbeing: (
          <Section title="Самочувствие" hint="Средняя оценка за последние 7 дней">
            <WellbeingFields
              items={WELLBEING}
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
          <Section title="Обратная связь" hint="Коротко, своими словами">
            <FeedbackFields
              items={FEEDBACK}
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
