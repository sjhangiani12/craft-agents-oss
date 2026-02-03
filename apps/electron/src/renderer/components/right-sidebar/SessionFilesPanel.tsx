/**
 * SessionFilesPanel - Standalone file explorer panel for the right sidebar "Files" tab
 *
 * When a session has workspace isolation (worktree), shows the worktree's project files.
 * Otherwise shows the session's storage files.
 */

import * as React from 'react'
import { useSession as useSessionData } from '@/context/AppShellContext'
import { SessionFilesSection } from './SessionFilesSection'

export interface SessionFilesPanelProps {
  sessionId?: string
}

export function SessionFilesPanel({ sessionId }: SessionFilesPanelProps) {
  const session = useSessionData(sessionId || '')

  if (!sessionId) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground p-4">
        <p className="text-sm text-center">No session selected</p>
      </div>
    )
  }

  const isWorktree = !!session?.worktreeBranch

  return (
    <div className="h-full flex flex-col">
      {/* Worktree indicator */}
      {isWorktree && session?.worktreeBranch && (
        <div className="shrink-0 px-4 pt-3 pb-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <svg className="h-3 w-3 shrink-0" viewBox="0 0 16 16" fill="currentColor">
              <path fillRule="evenodd" d="M11.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm-2.25.75a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.492 2.492 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25zM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zM3.5 3.25a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0z" />
            </svg>
            <span className="font-mono truncate">{session.worktreeBranch.replace(/^agent\//, '')}</span>
          </div>
        </div>
      )}

      {/* File tree */}
      <div className="flex-1 min-h-0">
        <SessionFilesSection sessionId={sessionId} isWorktree={isWorktree} />
      </div>
    </div>
  )
}
