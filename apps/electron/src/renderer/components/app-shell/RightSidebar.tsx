/**
 * RightSidebar - Tabbed right sidebar with Files, Terminal, and Info panels
 *
 * Tab bar at the top lets users switch between panel types.
 * Each panel renders its own content below the tabs.
 */

import * as React from 'react'
import { FolderOpen, TerminalSquare, Info } from 'lucide-react'
import type { RightSidebarPanel } from '../../../shared/types'
import { SessionMetadataPanel } from '../right-sidebar/SessionMetadataPanel'
import { SessionFilesPanel } from '../right-sidebar/SessionFilesPanel'
import { TerminalPanel } from '../right-sidebar/TerminalPanel'
import { cn } from '@/lib/utils'

export interface RightSidebarProps {
  /** Current panel configuration */
  panel: RightSidebarPanel
  /** Callback to change panel type */
  onPanelChange: (panel: RightSidebarPanel) => void
  /** Session ID (required for session-specific panels) */
  sessionId?: string
  /** Close button to display in panel header */
  closeButton?: React.ReactNode
}

const TABS = [
  { type: 'files' as const, label: 'Files', icon: FolderOpen },
  { type: 'terminal' as const, label: 'Terminal', icon: TerminalSquare },
  { type: 'sessionMetadata' as const, label: 'Info', icon: Info },
] as const

/**
 * Tabbed right sidebar
 */
export function RightSidebar({ panel, onPanelChange, sessionId, closeButton }: RightSidebarProps) {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="shrink-0 flex items-center gap-0 px-2 pt-2 pb-0 relative z-panel">
        {TABS.map((tab) => {
          const isActive = panel.type === tab.type
          const Icon = tab.icon
          return (
            <button
              key={tab.type}
              onClick={() => onPanelChange({ type: tab.type })}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer select-none titlebar-no-drag',
                isActive
                  ? 'bg-background text-foreground shadow-minimal'
                  : 'text-muted-foreground hover:text-foreground hover:bg-foreground-3'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          )
        })}
        {/* Spacer + close button */}
        <div className="flex-1" />
        <div className="titlebar-no-drag shrink-0">{closeButton}</div>
      </div>

      {/* Panel content */}
      <div className="flex-1 min-h-0">
        {panel.type === 'files' && (
          <SessionFilesPanel sessionId={sessionId} />
        )}
        {panel.type === 'terminal' && (
          <TerminalPanel sessionId={sessionId} />
        )}
        {panel.type === 'sessionMetadata' && (
          <SessionMetadataPanel sessionId={sessionId} />
        )}
      </div>
    </div>
  )
}
