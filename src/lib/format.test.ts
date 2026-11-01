import { describe, expect, it } from 'vitest'
import {
  formatDateOnly,
  formatInr,
  initials,
  parseDateOnly,
  pluralize,
} from './format'

describe('format helpers', () => {
  it('parses date-only values without a UTC day shift', () => {
    const date = parseDateOnly('2026-10-31')
    expect(date?.getFullYear()).toBe(2026)
    expect(date?.getMonth()).toBe(9)
    expect(date?.getDate()).toBe(31)
  })

  it('formats Indian rupee values for the dashboard', () => {
    expect(formatInr(1500)).toContain('1,500')
    expect(formatInr(null)).toBe('—')
  })

  it('renders a readable date and falls back for missing values', () => {
    expect(formatDateOnly('2026-10-31')).toBe('31 Oct 2026')
    expect(formatDateOnly(null)).toBe('—')
  })

  it('builds compact avatars and plural labels', () => {
    expect(initials('Aarav Sharma')).toBe('AS')
    expect(initials(null)).toBe('FD')
    expect(pluralize(1, 'approval')).toBe('1 approval')
    expect(pluralize(3, 'approval')).toBe('3 approvals')
  })
})
