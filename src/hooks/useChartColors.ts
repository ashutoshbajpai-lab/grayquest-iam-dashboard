'use client'

import { useFilterStore } from '@/store/filterStore'

export function useChartColors() {
  const isDark = useFilterStore(s => s.isDark)

  return isDark ? {
    primary:       '#E8B800',
    secondary:     '#60A5FA',
    success:       '#4ADE80',
    danger:        '#F87171',
    warning:       '#FBBF24',
    info:          '#60A5FA',
    tertiary:      '#34D399',
    grid:          '#2A2D3E',
    axis:          '#6B7280',
    label:         '#9CA3B0',
    tooltipBg:     '#1A1D27',
    tooltipBorder: '#2A2D3E',
    tooltipText:   '#FFFFFF',
  } : {
    primary:       '#C8920A',
    secondary:     '#E8B800',
    success:       '#0D9B6A',
    danger:        '#E53E3E',
    warning:       '#C8920A',
    info:          '#3B8EF0',
    tertiary:      '#0D9B6A',
    grid:          '#DAD5C8',
    axis:          '#958E82',
    label:         '#958E82',
    tooltipBg:     '#FFFFFF',
    tooltipBorder: '#DAD5C8',
    tooltipText:   '#1C1C1E',
  }
}
