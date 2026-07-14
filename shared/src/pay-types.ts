export const PAY_TYPES = [
  { id: 'per_mile', label: 'Per Mile/Km', unit: 'per km' },
  { id: 'hourly', label: 'Hourly Rate', unit: '/hr' },
  { id: 'per_load', label: 'Per Load', unit: '/load' },
  { id: 'percentage', label: '% of Revenue', unit: '% gross' },
  { id: 'salary', label: 'Fixed Salary', unit: '/month' },
] as const;

export type PayTypeId = (typeof PAY_TYPES)[number]['id'];
