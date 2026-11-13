import { describe, expect, it } from 'vitest'
import { clientTabFromLocation } from './tab'

describe('clientTabFromLocation', () => {
  it.each([
    ['?tab=week', 'current'],
    ['?tab=month', 'month'],
    ['?tab=unknown', 'current'],
    ['', 'current'],
  ])('maps %s to %s', (search, tab) => {
    expect(clientTabFromLocation({ search })).toBe(tab)
  })
})
