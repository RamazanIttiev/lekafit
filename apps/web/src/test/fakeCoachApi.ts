import type { ClientListItem, ClientProfile, CoachApi, Plan, Report } from '../api'
import { aPlan } from './fakeApi'

export const aListItem = (overrides: Partial<ClientListItem> = {}): ClientListItem => ({
  id: 1,
  firstName: 'Анна',
  lastName: 'Иванова',
  username: 'anna',
  lastReportWeek: '2026-11-09',
  hasMonthlyReport: false,
  unseenReports: 0,
  ...overrides,
})

export const fakeCoachApi = (options: {
  clients?: ClientListItem[]
  profile?: ClientProfile
  reports?: Report[]
}) => {
  const savedPlans: Plan[] = []
  const notifiedPlans: Plan[] = []
  const photoRequests: [number, string][] = []
  const profile = options.profile ?? {
    id: 1,
    firstName: 'Анна',
    lastName: null,
    username: null,
    plan: aPlan({ trainingMonth: 12, cardioMonth: 300 }),
  }
  const reports = options.reports ?? []
  const api: CoachApi = {
    clients: async () => options.clients ?? [],
    client: async () => profile,
    setPlan: async (_id, plan, options) => {
      savedPlans.push(plan)
      if (options?.notify) notifiedPlans.push(plan)
      return plan
    },
    clientReports: async () => reports,
    invite: async () => ({ url: 'https://t.me/lekafit_bot' }),
    photoDownloadLink: async (id, angle) => ({
      url: `https://example.test/api/photo-downloads/${id}-${angle}`,
      fileName: `LekaFit_Анна_Иванова_2026-11_${angle}.jpg`,
    }),
    photo: async (id, angle) => {
      photoRequests.push([id, angle])
      return new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' })
    },
    report: async (id) => {
      const found = reports.find((r) => r.id === id)
      if (!found) throw new Error('not found')
      return { ...found, client: profile }
    },
  }
  return { api, savedPlans, notifiedPlans, photoRequests }
}
