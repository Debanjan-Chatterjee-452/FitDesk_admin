export const adminKeys = {
  all: ['fitdesk-admin'] as const,
  gym: () => [...adminKeys.all, 'gym'] as const,
  paymentMethods: () => [...adminKeys.all, 'payment-methods'] as const,
  stats: () => [...adminKeys.all, 'stats'] as const,
  packages: () => [...adminKeys.all, 'packages'] as const,
  members: () => [...adminKeys.all, 'members'] as const,
  pendingPayments: () => [...adminKeys.all, 'pending-payments'] as const,
  closures: (from: string, to: string) => [...adminKeys.all, 'closures', from, to] as const,
  attendance: () => [...adminKeys.all, 'attendance'] as const,
  profile: () => [...adminKeys.all, 'profile'] as const,
  notifications: () => [...adminKeys.all, 'notifications'] as const,
  notificationsCount: () => [...adminKeys.all, 'notifications-count'] as const,
}
