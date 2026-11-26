export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say'
export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-'
export type LegalDocumentType =
  | 'Aadhaar Card'
  | 'PAN Card'
  | 'Driving Licence'
  | 'Passport'
  | 'Voter ID'
export type PaymentState = 'Pending' | 'Paid' | 'Not Paid'
export type MembershipState = 'pending' | 'active' | 'expired' | 'cancelled' | 'paused'

export interface AdminProfile {
  id: string
  phone: string
  full_name: string | null
  avatar_path: string | null
  date_of_birth: string | null
  blood_group: BloodGroup | null
  gender: Gender | null
  legal_document_path: string | null
  legal_document_name: string | null
  legal_document_mime_type: string | null
  legal_document_type: LegalDocumentType | null
  legal_document_number: string | null
  profile_completed: boolean
  created_at: string
  updated_at: string
  is_admin: boolean
  gym_id: string
}

export interface GymSettings {
  gym_id: string
  public_id: string | null
  join_code: string | null
  owner_id: string | null
  slug: string
  name: string
  admission_fee_inr: number | null
  upi_id: string | null
  upi_payee_name: string | null
  payment_qr_path: string | null
  is_open: boolean
  is_active: boolean
  suspended_at: string | null
  suspension_reason: string | null
  shutter_changed_at: string | null
  attendance_qr_months: number
  attendance_qr_rotated_at: string | null
  created_at: string
  updated_at: string
}

export type PaymentMethodKey = 'google_pay' | 'phonepe' | 'paytm' | 'upi'

export interface GymPaymentMethod {
  method: PaymentMethodKey
  is_enabled: boolean
  upi_id: string | null
  payee_name: string | null
  qr_path: string | null
  updated_at: string | null
}

export const PAYMENT_METHOD_ORDER: PaymentMethodKey[] = [
  'google_pay',
  'phonepe',
  'paytm',
  'upi',
]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodKey, string> = {
  google_pay: 'Google Pay',
  phonepe: 'PhonePe',
  paytm: 'Paytm',
  upi: 'General UPI',
}

export interface DashboardStats {
  total_members: number
  active_members: number
  pending_approvals: number
  expiring_soon: number
  expiring_1d: number
  expiring_3d: number
  expiring_7d: number
  expired: number
  deactivated_members: number
  today_checkins: number
  revenue_month_inr: number
  active_packages: number
  is_open: boolean
  today: string
}

export interface PackageRow {
  id: string
  name: string
  description: string | null
  duration_months: number
  duration_days: number
  price_inr: number
  is_active: boolean
  is_recommended: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface NotificationRow {
  id: string
  kind: string
  title: string
  body: string
  payload: Record<string, unknown>
  user_id: string | null
  membership_id: string | null
  member_name: string | null
  member_phone: string | null
  is_read: boolean
  created_at: string
}

export interface MemberRow {
  user_id: string
  full_name: string
  email: string | null
  phone: string | null
  avatar_path: string | null
  joined_at: string
  plan_name: string | null
  plan_package_id?: string | null
  plan_duration_days?: number | null
  membership_status: MembershipState | null
  membership_id: string | null
  starts_on: string | null
  ends_on: string | null
  payment_status: PaymentState
  pending_payment_id: string | null
  pending_amount_inr: number | null
  pending_reference: string | null
  pending_since: string | null
  pending_plan_name: string | null
  /** upi, phonepe, google_pay, paytm or cash. */
  pending_method: string | null
  /** Live 6-digit cash code. Only present for a cash request. */
  pending_otp: string | null
  pending_otp_expires_at: string | null
  /** 'current' for an active gym member, 'left' after they left or changed gym. */
  gym_state: 'current' | 'left'
  left_at: string | null
  activity_at: string
  total_count?: number
  is_deactivated?: boolean
}

export interface RenewalQuote {
  package_id: string
  package_name: string
  duration_days: number
  base_amount: number
  fine_amount: number
  total_amount: number
  starts_on: string
  ends_on: string
  current_ends_on: string | null
  is_stacked: boolean
  fine_reason: string | null
}

export interface PendingPayment {
  payment_id: string
  user_id: string
  member_name: string
  member_email: string | null
  member_phone: string | null
  package_name: string
  duration_days: number
  base_amount_inr: number
  fine_amount_inr: number
  total_amount_inr: number
  status: 'pending'
  provider_order_id: string | null
  provider_payment_id: string | null
  failure_reason: string | null
  quote: RenewalQuote | null
  created_at: string
  paid_at: string | null
  reviewed_at: string | null
  reviewed_by: string | null
  checkout_state: string | null
  reconciliation_required: boolean
  reconciliation_reason: string | null
  legacy_status: string | null
  refund_status: string
  refund_note: string | null
  refunded_at: string | null
  refunded_by: string | null
  screenshot_path: string | null
  payment_method: string | null
  cash_otp: string | null
  cash_otp_expires_at: string | null
  upi_submitted_at: string | null
  is_new_admission: boolean
}

export interface PaymentReviewResult {
  status: 'approved' | 'declined'
  payment_id: string
  membership_id: string | null
  starts_on: string | null
  ends_on: string | null
  package_name: string
  total_amount_inr: number
}

export interface ClosureRow {
  closure_date: string
  reason: string
  announcement_id: string
}

export interface AttendanceQr {
  id: string
  label: string
  token: string | null
  created_at: string
}

export interface AttendanceQrState {
  qr: AttendanceQr | null
  rotation_months: number
  rotated_at: string | null
  next_rotation_at: string | null
}

export interface ProfileInput {
  full_name: string
  date_of_birth: string
  blood_group: BloodGroup
  gender: Gender
  legal_document_path: string | null
  legal_document_name: string | null
  legal_document_mime_type: string | null
}
