import { Alert } from '@heroui/react'

export const Notice = ({
  status,
  indicator = false,
  children,
}: {
  status?: 'danger' | 'success'
  indicator?: boolean
  children: string
}) => (
  <Alert status={status}>
    {indicator && <Alert.Indicator />}
    <Alert.Content>
      <Alert.Title>{children}</Alert.Title>
    </Alert.Content>
  </Alert>
)
