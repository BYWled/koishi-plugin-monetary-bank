export function calculateNextSettlementDate(cycle: 'day' | 'week' | 'month', isNew: boolean = false): Date {
  const now = new Date()
  const settlement = new Date(now)
  
  settlement.setHours(0, 0, 0, 0)
  
  if (isNew) {
    settlement.setDate(settlement.getDate() + 1)
  }
  
  switch (cycle) {
    case 'day':
      settlement.setDate(settlement.getDate() + 1)
      break
    case 'week':
      settlement.setDate(settlement.getDate() + 7)
      break
    case 'month':
      settlement.setDate(settlement.getDate() + 30)
      break
  }
  
  return settlement
}
