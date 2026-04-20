'use client'
import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Subscribes to Supabase Realtime on dx_snapshots.
 * Calls onUpdate(id, newData) whenever a row changes.
 * Automatically cleans up on unmount.
 */
export function useRealtimeSnapshot(
  onUpdate: (id: string, data: Record<string, unknown>) => void
) {
  const cbRef = useRef(onUpdate)
  cbRef.current = onUpdate

  useEffect(() => {
    const channel = supabase
      .channel('dx_snapshots_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dx_snapshots' },
        (payload) => {
          const row = payload.new as { id: string; data: Record<string, unknown> }
          if (row?.id && row?.data) {
            cbRef.current(row.id, row.data)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])
}
