/**
 * FileTabContent - Renders file content inline in the main panel (as a tab)
 *
 * Supports code (with syntax highlighting), markdown, JSON, text, and images.
 * For unsupported types, shows a message with an "Open Externally" button.
 */

import * as React from 'react'
import { useState, useEffect } from 'react'
import { ExternalLink } from 'lucide-react'
import { ShikiCodeViewer } from '@/components/shiki'
import type { FileTab } from '@/hooks/useFileTabs'

export interface FileTabContentProps {
  tab: FileTab
}

export function FileTabContent({ tab }: FileTabContentProps) {
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)

  // Load image data URL for image tabs
  useEffect(() => {
    if (tab.type === 'image') {
      window.electronAPI.readFileDataUrl(tab.filePath).then(setImageDataUrl).catch(() => {})
    }
  }, [tab.type, tab.filePath])

  if (tab.error) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground p-8">
        <p className="text-sm text-center">Failed to read file: {tab.error}</p>
      </div>
    )
  }

  // Code files — syntax highlighted
  if (tab.type === 'code' && tab.content != null) {
    return (
      <div className="h-full overflow-auto">
        <div className="p-4">
          <div className="text-xs text-muted-foreground mb-2 font-mono select-none">{tab.filePath}</div>
          <ShikiCodeViewer
            code={tab.content}
            language={tab.language || 'text'}
          />
        </div>
      </div>
    )
  }

  // JSON files — syntax highlighted as JSON
  if (tab.type === 'json' && tab.content != null) {
    return (
      <div className="h-full overflow-auto">
        <div className="p-4">
          <div className="text-xs text-muted-foreground mb-2 font-mono select-none">{tab.filePath}</div>
          <ShikiCodeViewer
            code={tab.content}
            language="json"
          />
        </div>
      </div>
    )
  }

  // Markdown / text files — plain text with monospace
  if ((tab.type === 'markdown' || tab.type === 'text') && tab.content != null) {
    return (
      <div className="h-full overflow-auto">
        <div className="p-4">
          <div className="text-xs text-muted-foreground mb-2 font-mono select-none">{tab.filePath}</div>
          <pre className="text-sm font-mono whitespace-pre-wrap break-words leading-relaxed">
            {tab.content}
          </pre>
        </div>
      </div>
    )
  }

  // Image files
  if (tab.type === 'image') {
    return (
      <div className="h-full overflow-auto flex items-center justify-center p-8">
        {imageDataUrl ? (
          <img src={imageDataUrl} alt={tab.fileName} className="max-w-full max-h-full object-contain rounded" />
        ) : (
          <p className="text-sm text-muted-foreground">Loading image...</p>
        )}
      </div>
    )
  }

  // Unsupported — offer to open externally
  return (
    <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 gap-3">
      <p className="text-sm">Cannot preview this file type inline.</p>
      <button
        onClick={() => window.electronAPI.openFile(tab.filePath)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-accent text-white hover:bg-accent/90 transition-colors cursor-pointer"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Open Externally
      </button>
    </div>
  )
}
