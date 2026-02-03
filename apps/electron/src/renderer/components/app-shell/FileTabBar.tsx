/**
 * FileTabBar - Tab bar showing open file tabs alongside the chat tab
 *
 * Rendered between PanelHeader and chat content.
 * Chat is always the first tab. File tabs can be closed with X.
 */

import * as React from 'react'
import { X, MessageSquare, FileCode, Image, FileText, FileJson } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FileTab } from '@/hooks/useFileTabs'

export interface FileTabBarProps {
  tabs: FileTab[]
  activeTabId: string | null
  onSelectTab: (tabId: string | null) => void
  onCloseTab: (tabId: string) => void
  sessionName?: string
}

function getFileIcon(type: FileTab['type']) {
  switch (type) {
    case 'code': return FileCode
    case 'image': return Image
    case 'json': return FileJson
    default: return FileText
  }
}

export function FileTabBar({ tabs, activeTabId, onSelectTab, onCloseTab, sessionName }: FileTabBarProps) {
  // Don't render if no file tabs are open
  if (tabs.length === 0) return null

  return (
    <div className="shrink-0 flex items-center gap-0 border-b border-border/50 bg-foreground-2/50 overflow-x-auto">
      {/* Chat tab (always first) */}
      <button
        onClick={() => onSelectTab(null)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium shrink-0 border-b-2 transition-colors cursor-pointer select-none',
          activeTabId === null
            ? 'border-accent text-foreground bg-background/50'
            : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-foreground-3'
        )}
      >
        <MessageSquare className="h-3 w-3" />
        <span className="truncate max-w-[120px]">{sessionName || 'Chat'}</span>
      </button>

      {/* File tabs */}
      {tabs.map((tab) => {
        const Icon = getFileIcon(tab.type)
        const isActive = activeTabId === tab.id
        return (
          <div
            key={tab.id}
            className={cn(
              'flex items-center gap-1 pl-3 pr-1 py-1.5 text-xs font-medium shrink-0 border-b-2 transition-colors group',
              isActive
                ? 'border-accent text-foreground bg-background/50'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-foreground-3'
            )}
          >
            <button
              onClick={() => onSelectTab(tab.id)}
              className="flex items-center gap-1.5 cursor-pointer select-none"
            >
              <Icon className="h-3 w-3 shrink-0" />
              <span className="truncate max-w-[120px]">{tab.fileName}</span>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onCloseTab(tab.id) }}
              className="p-0.5 rounded hover:bg-foreground-3 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ml-1"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
