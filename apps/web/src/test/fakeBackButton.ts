import type { BackButton } from '../telegram'

export const fakeBackButton = () => {
  const state = { visible: false, handlers: [] as Array<() => void> }
  const backButton: BackButton = {
    show: () => {
      state.visible = true
    },
    hide: () => {
      state.visible = false
    },
    onClick: (cb) => {
      state.handlers = [...state.handlers, cb]
    },
    offClick: (cb) => {
      state.handlers = state.handlers.filter((h) => h !== cb)
    },
  }
  return {
    backButton,
    isVisible: () => state.visible,
    press: () => {
      for (const h of state.handlers) h()
    },
  }
}
