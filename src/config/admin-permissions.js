const ADMIN_PERMISSION_MODULES = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    description: 'Admin dashboard visibility and stats access',
    supports: { read: true, write: false }
  },
  {
    key: 'kyc',
    label: 'KYC',
    description: 'KYC review, approval, and rejection actions',
    supports: { read: true, write: true }
  },
  {
    key: 'payment_settings',
    label: 'Payment Settings',
    description: 'Currency rates, gateways, and bank account configuration',
    supports: { read: true, write: true }
  },
  {
    key: 'bank_transfers',
    label: 'Bank Transfers',
    description: 'Bank transfer review and approval handling',
    supports: { read: true, write: true }
  },
  {
    key: 'withdrawals',
    label: 'Withdrawals',
    description: 'Withdrawal review, approval, and completion',
    supports: { read: true, write: true }
  },
  {
    key: 'investor_accounts',
    label: 'Investor Accounts',
    description: 'Investor account listing, approvals, and status changes',
    supports: { read: true, write: true }
  },
  {
    key: 'investor_transactions',
    label: 'Investor Transactions',
    description: 'Investor transaction and account-transaction visibility',
    supports: { read: true, write: false }
  },
  {
    key: 'investor_performance',
    label: 'Investor Performance',
    description: 'Investor balance, equity, and profit/loss updates',
    supports: { read: true, write: true }
  },
  {
    key: 'matchtrader_offers',
    label: 'Match-Trader Offers',
    description: 'Customer-visible Match-Trader offer catalog and leverage package management',
    supports: { read: true, write: true }
  }
]

const LEGACY_ROLE_PERMISSION_MAP = {
  superadmin: ADMIN_PERMISSION_MODULES.flatMap((module) => {
    const granted = []
    if (module.supports.read) granted.push(`${module.key}.read`)
    if (module.supports.write) granted.push(`${module.key}.write`)
    return granted
  }),
  admin: [
    'dashboard.read',
    'kyc.read',
    'kyc.write',
    'payment_settings.read',
    'bank_transfers.read',
    'bank_transfers.write',
    'withdrawals.read',
    'withdrawals.write',
    'investor_accounts.read',
    'investor_accounts.write',
    'investor_transactions.read',
    'investor_performance.read',
    'investor_performance.write',
    'matchtrader_offers.read',
    'matchtrader_offers.write'
  ],
  accounts: [
    'dashboard.read',
    'bank_transfers.read',
    'withdrawals.read',
    'investor_accounts.read',
    'investor_transactions.read',
    'investor_performance.read',
    'investor_performance.write',
    'matchtrader_offers.read'
  ]
}

function getPermissionCatalog() {
  return ADMIN_PERMISSION_MODULES.map((module) => ({
    ...module,
    supports: {
      read: Boolean(module.supports?.read),
      write: Boolean(module.supports?.write)
    }
  }))
}

function getPermissionModule(key) {
  return ADMIN_PERMISSION_MODULES.find((module) => module.key === String(key || '').trim())
}

function getLegacyPermissions(role) {
  const normalizedRole = String(role || '').trim().toLowerCase()
  return [...(LEGACY_ROLE_PERMISSION_MAP[normalizedRole] || [])]
}

module.exports = {
  getPermissionCatalog,
  getPermissionModule,
  getLegacyPermissions
}
