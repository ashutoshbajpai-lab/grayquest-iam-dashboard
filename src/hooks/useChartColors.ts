'use client'

import { useFilterStore } from '@/store/filterStore'

export function useChartColors() {
  const isDark = useFilterStore(s => s.isDark)

  return isDark ? {
    primary:       '#818CF8',   /* indigo-400 */
    secondary:     '#60A5FA',   /* blue-400 */
    success:       '#34D399',   /* emerald-400 */
    danger:        '#F87171',   /* red-400 */
    warning:       '#FBBF24',   /* amber-400 */
    info:          '#60A5FA',   /* blue-400 */
    tertiary:      '#A78BFA',   /* violet-400 */
    grid:          '#1E2D4A',
    axis:          '#4B5B7A',
    label:         '#8DA0C4',
    tooltipBg:     '#0F1629',
    tooltipBorder: '#1E2D4A',
    tooltipText:   '#F0F4FF',
  } : {
    primary:       '#4F46E5',   /* indigo-600 */
    secondary:     '#7C3AED',   /* violet-600 */
    success:       '#059669',   /* emerald-600 */
    danger:        '#DC2626',   /* red-600 */
    warning:       '#D97706',   /* amber-600 */
    info:          '#2563EB',   /* blue-600 */
    tertiary:      '#0891B2',   /* cyan-600 */
    grid:          '#DDE2F0',
    axis:          '#8B93B8',
    label:         '#8B93B8',
    tooltipBg:     '#FFFFFF',
    tooltipBorder: '#DDE2F0',
    tooltipText:   '#0D1136',
  }
}
