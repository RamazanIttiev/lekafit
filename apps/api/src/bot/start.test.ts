import { describe, expect, it } from 'vitest'
import { startReply } from './bot'

describe('/start reply', () => {
  it('greets the client and offers a button that opens the mini app', () => {
    expect(startReply('https://app.example')).toEqual({
      text: expect.stringContaining('LekaFit'),
      webAppButton: { text: '📋 Недельный отчёт', url: 'https://app.example' },
    })
  })
})
