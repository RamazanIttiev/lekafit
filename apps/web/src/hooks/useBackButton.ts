import { useEffect } from 'react'
import type { BackButton } from '../telegram'

export const useBackButton = (backButton: BackButton, onBack: (() => void) | null) => {
  useEffect(() => {
    if (!onBack) return
    backButton.onClick(onBack)
    backButton.show()
    return () => {
      backButton.offClick(onBack)
      backButton.hide()
    }
  }, [backButton, onBack])
}
