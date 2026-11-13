import { describe, expect, it } from 'vitest'
import { startReply } from './bot'

describe('/start reply', () => {
  it('greets the client and offers weekly and monthly buttons that open the mini app', () => {
    expect(startReply('https://app.example')).toEqual({
      text: expect.stringContaining('LekaFit'),
      webAppButtons: [
        { text: '📋 Недельный отчёт', url: 'https://app.example/?tab=week' },
        { text: '📅 Месячный отчёт', url: 'https://app.example/?tab=month' },
      ],
    })
  })
})
