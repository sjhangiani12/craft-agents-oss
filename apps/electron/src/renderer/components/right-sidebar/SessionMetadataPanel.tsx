/**
 * SessionMetadataPanel - Session info panel (name, notes, worktree info)
 *
 * Displayed as the "Info" tab in the right sidebar.
 */

import * as React from 'react'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession as useSessionData, useAppShellContext } from '@/context/AppShellContext'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'

export interface SessionMetadataPanelProps {
  sessionId?: string
}


/**
 * Custom hook for debounced callback
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function useDebouncedCallback<T extends (...args: any[]) => void>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const callbackRef = useRef(callback)

  // Keep callback ref up to date
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args)
      }, delay)
    }) as T,
    [delay]
  )
}

/**
 * Panel displaying session metadata with minimal styling
 */
export function SessionMetadataPanel({ sessionId }: SessionMetadataPanelProps) {
  const { onRenameSession } = useAppShellContext()
  const containerRef = useRef<HTMLDivElement>(null)

  // State for editable fields
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [notesLoaded, setNotesLoaded] = useState(false)

  // Get session data
  const session = useSessionData(sessionId || '')

  // Initialize name from session
  useEffect(() => {
    setName(session?.name || '')
  }, [session?.name])

  // Load notes when session changes
  useEffect(() => {
    if (!sessionId) return

    // Load notes
    window.electronAPI.getSessionNotes(sessionId).then((content) => {
      setNotes(content)
      setNotesLoaded(true)
    })
  }, [sessionId])

  // Debounced save for name
  const debouncedSaveName = useDebouncedCallback(
    (newName: string) => {
      if (sessionId && newName.trim()) {
        onRenameSession(sessionId, newName.trim())
      }
    },
    500
  )

  // Debounced save for notes
  const debouncedSaveNotes = useDebouncedCallback(
    (content: string) => {
      if (sessionId) {
        window.electronAPI.setSessionNotes(sessionId, content)
      }
    },
    500
  )

  // Handle name change
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value
    setName(newName)
    debouncedSaveName(newName)
  }

  // Handle notes change
  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const content = e.target.value
    setNotes(content)
    debouncedSaveNotes(content)
  }

  // Early return if no sessionId
  if (!sessionId) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground p-4">
        <p className="text-sm text-center">No session selected</p>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground p-4">
        <p className="text-sm text-center">Loading session...</p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="h-full flex flex-col">

      {/* Metadata section (Name + Notes) */}
      <div className="flex-1 overflow-auto p-4 space-y-5">
        {/* Name */}
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1.5 select-none">
            Name
          </label>
          <div className="rounded-lg bg-foreground-2 has-[:focus]:bg-background shadow-minimal transition-colors">
            <Input
              value={name}
              onChange={handleNameChange}
              placeholder="Untitled"
              className="h-9 py-2 text-sm border-0 shadow-none bg-transparent focus-visible:ring-0"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1.5 select-none">
            Notes
          </label>
          <div className="rounded-lg bg-foreground-2 has-[:focus]:bg-background shadow-minimal transition-colors">
            <Textarea
              value={notes}
              onChange={handleNotesChange}
              placeholder={notesLoaded ? 'Add notes...' : 'Loading...'}
              disabled={!notesLoaded}
              spellCheck={false}
              className="text-sm min-h-[80px] py-2 resize-y border-0 shadow-none bg-transparent focus-visible:ring-0 placeholder:select-none"
            />
          </div>
        </div>

        {/* Worktree Info (only shown for sessions with workspace isolation) */}
        {session.worktreeBranch && (
          <WorktreeInfoSection sessionId={sessionId} session={session} />
        )}
      </div>

    </div>
  )
}

/**
 * Worktree info section - shows branch, path, modified count, port, and diff button
 */
function WorktreeInfoSection({ sessionId, session }: { sessionId: string; session: { worktreeBranch?: string; worktreePath?: string; allocatedPort?: number } }) {
  const [worktreeStatus, setWorktreeStatus] = useState<{ branch: string; modified: number; untracked: number } | null>(null)
  const [showDiff, setShowDiff] = useState(false)
  const [diff, setDiff] = useState<string | null>(null)

  useEffect(() => {
    window.electronAPI.worktreeGetStatus(sessionId).then(setWorktreeStatus).catch(() => {})
  }, [sessionId])

  const handleViewDiff = async () => {
    if (showDiff) {
      setShowDiff(false)
      return
    }
    const d = await window.electronAPI.worktreeGetDiff(sessionId)
    setDiff(d || 'No changes')
    setShowDiff(true)
  }

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground block mb-1.5 select-none">
        Workspace Isolation
      </label>
      <div className="rounded-lg bg-foreground-2 p-3 space-y-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground shrink-0">Branch</span>
          <span className="font-mono text-foreground truncate">{session.worktreeBranch}</span>
        </div>
        {session.worktreePath && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground shrink-0">Path</span>
            <span className="font-mono text-foreground truncate" title={session.worktreePath}>
              {session.worktreePath.replace(/^.*\/worktrees\//, '~/.../worktrees/')}
            </span>
          </div>
        )}
        {worktreeStatus && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground shrink-0">Files</span>
            <span className="text-foreground">
              {worktreeStatus.modified} modified, {worktreeStatus.untracked} untracked
            </span>
          </div>
        )}
        {session.allocatedPort != null && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground shrink-0">Port</span>
            <span className="font-mono text-foreground">{session.allocatedPort}</span>
          </div>
        )}
        <button
          onClick={handleViewDiff}
          className="text-xs text-accent hover:underline cursor-pointer mt-1"
        >
          {showDiff ? 'Hide diff' : 'View diff'}
        </button>
        {showDiff && diff && (
          <pre className="mt-2 p-2 rounded bg-background text-[10px] font-mono overflow-auto max-h-[200px] whitespace-pre-wrap break-all">
            {diff}
          </pre>
        )}
      </div>
    </div>
  )
}
