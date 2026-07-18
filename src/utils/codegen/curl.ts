/**
 * cURL code generator.
 *
 * Reuses the existing exportToCurl utility.
 */

import type { CodegenInput } from './types'
import { exportToCurl } from '@/utils/export-curl'

export function generateCurl(input: CodegenInput): string {
  return exportToCurl(input)
}
