export const SAFETY_EVENT_TYPES = [
  'accident',
  'incident',
  'violation',
  'coaching',
  'corrective_action',
] as const;

export type SafetyEventType = (typeof SAFETY_EVENT_TYPES)[number];

export const SAFETY_EVENT_LABELS: Record<SafetyEventType, string> = {
  accident: 'Accident',
  incident: 'Incident',
  violation: 'Traffic Violation',
  coaching: 'Coaching Session',
  corrective_action: 'Corrective Action',
};

export const TRAINING_COURSES = [
  { code: 'orientation', name: 'Orientation' },
  { code: 'defensive_driving', name: 'Defensive Driving' },
  { code: 'winter_driving', name: 'Winter Driving' },
  { code: 'dangerous_goods', name: 'Dangerous Goods' },
  { code: 'forklift', name: 'Forklift' },
  { code: 'first_aid', name: 'First Aid' },
  { code: 'company_policies', name: 'Company Policies' },
  { code: 'annual_refresher', name: 'Annual Refresher' },
] as const;

export type TrainingCourseCode = (typeof TRAINING_COURSES)[number]['code'];

export const EQUIPMENT_ASSIGNMENT_TYPES = [
  'truck',
  'trailer',
  'eld',
  'fuel_card',
  'tablet',
  'phone',
  'safety',
] as const;

export type EquipmentAssignmentType =
  (typeof EQUIPMENT_ASSIGNMENT_TYPES)[number];

export const EQUIPMENT_ASSIGNMENT_ROLES = ['primary', 'secondary'] as const;
export type EquipmentAssignmentRole =
  (typeof EQUIPMENT_ASSIGNMENT_ROLES)[number];
