import type { GymPaymentMethod, GymSettings, PaymentMethodKey } from '@/types'
import { AppError, toAppError } from '../errors'
import { getSupabase } from '../supabase'
import { callRpc } from './client'

const PAYMENT_QR_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])
const PAYMENT_QR_LIMIT = 5 * 1024 * 1024

function extensionFor(file: File): string {
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/jpeg') return 'jpg'
  if (file.type === 'image/webp') return 'webp'
  const extension = file.name.split('.').pop()?.toLowerCase()
  return extension && /^[a-z0-9]{2,5}$/.test(extension) ? extension : 'png'
}

export function validatePaymentQr(file: File): void {
  if (!PAYMENT_QR_TYPES.has(file.type)) {
    throw new AppError('INVALID_QR_FILE', 'Upload a PNG, JPG, or WEBP image.')
  }
  if (file.size > PAYMENT_QR_LIMIT) {
    throw new AppError('QR_FILE_TOO_LARGE', 'The QR image must be 5 MB or smaller.')
  }
}

export function paymentQrPublicUrl(path: string | null | undefined): string | null {
  if (!path) return null
  const { data } = getSupabase().storage.from('gym-payment-qr').getPublicUrl(path)
  return data.publicUrl
}

/** All four rails for the signed-in admin's gym, including disabled ones. */
export function getPaymentMethods() {
  return callRpc<GymPaymentMethod[]>('admin_get_payment_methods')
}

export interface SavePaymentMethodInput {
  gymId: string
  method: PaymentMethodKey
  isEnabled: boolean
  upiId: string
  payeeName: string
  currentQrPath: string | null
  qrFile: File | null
  clearQr: boolean
}

/**
 * Uploads the QR (if any) then saves the rail. The QR and the UPI ID are
 * independent: either, both, or neither may be present.
 */
export async function savePaymentMethod(
  input: SavePaymentMethodInput,
): Promise<GymPaymentMethod[]> {
  let uploadedPath: string | null = null

  try {
    if (input.qrFile) {
      validatePaymentQr(input.qrFile)
      const path = `${input.gymId}/payment-qr-${input.method}-${Date.now()}-${crypto
        .randomUUID()
        .slice(0, 8)}.${extensionFor(input.qrFile)}`
      const { error } = await getSupabase()
        .storage.from('gym-payment-qr')
        .upload(path, input.qrFile, {
          contentType: input.qrFile.type,
          cacheControl: '3600',
          upsert: false,
        })
      if (error) throw toAppError(error)
      uploadedPath = path
    }

    const nextPath = input.clearQr ? null : (uploadedPath ?? input.currentQrPath)

    const methods = await callRpc<GymPaymentMethod[]>('admin_save_payment_method', {
      p_method: input.method,
      p_is_enabled: input.isEnabled,
      p_upi_id: input.upiId.trim() || null,
      p_payee_name: input.payeeName.trim() || null,
      p_qr_path: nextPath,
      p_clear_qr: input.clearQr,
    })

    if (input.currentQrPath && input.currentQrPath !== nextPath) {
      await getSupabase()
        .storage.from('gym-payment-qr')
        .remove([input.currentQrPath])
    }

    return methods
  } catch (error) {
    if (uploadedPath) {
      await getSupabase().storage.from('gym-payment-qr').remove([uploadedPath])
    }
    throw toAppError(error)
  }
}

/** Legacy single-UPI save, kept for the gym-name editor. */
export interface PaymentSettingsInput {
  gymId: string
  upiId: string
  payeeName: string
  currentQrPath: string | null
  qrFile: File | null
  clearQr: boolean
}

export async function savePaymentSettings(input: PaymentSettingsInput): Promise<GymSettings> {
  let uploadedPath: string | null = null

  try {
    if (input.qrFile) {
      validatePaymentQr(input.qrFile)
      const path = `${input.gymId}/payment-qr-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extensionFor(input.qrFile)}`
      const { error } = await getSupabase()
        .storage.from('gym-payment-qr')
        .upload(path, input.qrFile, {
          contentType: input.qrFile.type,
          cacheControl: '3600',
          upsert: false,
        })
      if (error) throw toAppError(error)
      uploadedPath = path
    }

    const nextPath = input.clearQr ? null : (uploadedPath ?? input.currentQrPath)

    const settings = await callRpc<GymSettings>('admin_update_payment_settings', {
      p_upi_id: input.upiId.trim() || null,
      p_upi_payee_name: input.payeeName.trim() || null,
      p_qr_path: nextPath,
      p_clear_qr: input.clearQr,
    })

    if (input.currentQrPath && input.currentQrPath !== nextPath) {
      await getSupabase().storage.from('gym-payment-qr').remove([input.currentQrPath])
    }

    return settings
  } catch (error) {
    if (uploadedPath) {
      await getSupabase().storage.from('gym-payment-qr').remove([uploadedPath])
    }
    throw toAppError(error)
  }
}

export function updateGymName(name: string) {
  return callRpc<GymSettings>('admin_update_gym_name', { p_name: name })
}
