import type { AdminProfile, BloodGroup, Gender, ProfileInput } from '@/types'
import { AppError, toAppError } from '../errors'
import { getSupabase } from '../supabase'

const DOCUMENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
])
const DOCUMENT_LIMIT = 10 * 1024 * 1024

function extensionFor(file: File): string {
  if (file.type === 'application/pdf') return 'pdf'
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  if (file.type === 'image/heic' || file.type === 'image/heif') return 'heic'
  const extension = file.name.split('.').pop()?.toLowerCase()
  return extension && /^[a-z0-9]{2,5}$/.test(extension) ? extension : 'jpg'
}

function validateDocument(file: File): void {
  if (!DOCUMENT_TYPES.has(file.type)) {
    throw new AppError(
      'INVALID_DOCUMENT_FILE',
      'Upload a PDF, JPG, PNG, WEBP, or HEIC document.',
    )
  }
  if (file.size > DOCUMENT_LIMIT) {
    throw new AppError('DOCUMENT_TOO_LARGE', 'The document must be 10 MB or smaller.')
  }
}

export async function getMyProfile(userId: string): Promise<AdminProfile> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) throw toAppError(error)
  return data as AdminProfile
}

export interface ProfileSaveInput extends ProfileInput {
  userId: string
  currentDocumentPath: string | null
  documentFile: File | null
}

export async function saveMyProfile(input: ProfileSaveInput): Promise<AdminProfile> {
  let uploadedPath: string | null = null

  try {
    if (input.documentFile) {
      validateDocument(input.documentFile)
      uploadedPath = `${input.userId}/legal-${crypto.randomUUID()}.${extensionFor(input.documentFile)}`
      const { error } = await getSupabase()
        .storage.from('legal-documents')
        .upload(uploadedPath, input.documentFile, {
          contentType: input.documentFile.type,
          cacheControl: '3600',
          upsert: false,
        })
      if (error) throw toAppError(error)
    }

    const documentPath = uploadedPath ?? input.legal_document_path
    const patch: Record<string, unknown> = {
      full_name: input.full_name.trim(),
      date_of_birth: input.date_of_birth || null,
      blood_group: input.blood_group as BloodGroup,
      gender: input.gender as Gender,
    }

    if (uploadedPath && input.documentFile) {
      patch.legal_document_path = uploadedPath
      patch.legal_document_name = input.documentFile.name
      patch.legal_document_type = input.documentFile.type
    }

    if (!documentPath) {
      throw new AppError('DOCUMENT_REQUIRED', 'Upload one legal document before saving.')
    }

    const { data, error } = await getSupabase()
      .from('profiles')
      .update(patch)
      .eq('id', input.userId)
      .select('*')
      .single()

    if (error) throw toAppError(error)

    if (input.currentDocumentPath && uploadedPath && input.currentDocumentPath !== uploadedPath) {
      await getSupabase()
        .storage.from('legal-documents')
        .remove([input.currentDocumentPath])
    }

    return data as AdminProfile
  } catch (error) {
    if (uploadedPath) {
      await getSupabase().storage.from('legal-documents').remove([uploadedPath])
    }
    throw toAppError(error)
  }
}

export async function getDocumentSignedUrl(path: string): Promise<string> {
  const { data, error } = await getSupabase()
    .storage.from('legal-documents')
    .createSignedUrl(path, 60 * 10)
  if (error) throw toAppError(error)
  if (!data?.signedUrl) {
    throw new AppError('DOCUMENT_UNAVAILABLE', 'The document link could not be created.')
  }
  return data.signedUrl
}
