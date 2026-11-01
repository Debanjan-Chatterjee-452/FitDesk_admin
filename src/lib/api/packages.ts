import type { PackageRow } from '@/types'
import { callRpc } from './client'

export interface PackageInput {
  id?: string
  months: number
  priceInr: number
  name?: string
  description?: string
  isRecommended?: boolean
}

export function listAdminPackages() {
  return callRpc<PackageRow[]>('admin_list_packages')
}

export function savePackage(input: PackageInput) {
  return callRpc<{
    id: string
    name: string
    duration_months: number
    duration_days: number
    price_inr: number
    is_active: boolean
  }>('admin_upsert_package', {
    p_months: input.months,
    p_price_inr: input.priceInr,
    p_name: input.name?.trim() || null,
    p_description: input.description?.trim() || null,
    p_id: input.id ?? null,
    p_is_recommended: input.isRecommended ?? false,
  })
}

export function setPackageActive(id: string, active: boolean) {
  return callRpc<{ id: string; is_active: boolean }>('admin_set_package_active', {
    p_id: id,
    p_active: active,
  })
}
