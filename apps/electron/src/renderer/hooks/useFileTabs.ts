/**
 * useFileTabs - Manages file tabs open alongside the chat
 *
 * Tracks which files are open as tabs per session.
 * The chat is always the first "tab" (implicit, not tracked here).
 */

import { useState, useCallback } from 'react'
import { classifyFile } from '@craft-agent/ui'
import { getLanguageFromPath } from '@/lib/file-utils'

export interface FileTab {
  id: string
  filePath: string
  fileName: string
  type: 'code' | 'image' | 'markdown' | 'json' | 'text' | 'pdf' | 'unknown'
  language?: string
  content?: string | null
  error?: string
}

export interface FileTabsState {
  tabs: FileTab[]
  activeTabId: string | null // null means chat is active
}

export function useFileTabs() {
  const [state, setState] = useState<FileTabsState>({
    tabs: [],
    activeTabId: null,
  })

  const openFile = useCallback(async (filePath: string) => {
    // Check if already open — use functional state to avoid stale closure
    setState(prev => {
      const existing = prev.tabs.find(t => t.filePath === filePath)
      if (existing) {
        return { ...prev, activeTabId: existing.id }
      }
      return prev
    })

    // Check again outside setState for the async read path
    // (We can't do async inside setState)
    const alreadyOpen = state.tabs.find(t => t.filePath === filePath)
    if (alreadyOpen) return

    const fileName = filePath.split('/').pop() || filePath
    const classification = classifyFile(filePath)
    const type: FileTab['type'] = classification.type ?? 'text'
    const language = type === 'code' ? getLanguageFromPath(filePath) : undefined

    const tab: FileTab = {
      id: `tab_${Date.now()}`,
      filePath,
      fileName,
      type,
      language,
      content: null,
    }

    // Read content for text-based files
    if (type === 'code' || type === 'markdown' || type === 'json' || type === 'text') {
      try {
        const content = await window.electronAPI.readFile(filePath)
        tab.content = content
      } catch (err) {
        tab.error = err instanceof Error ? err.message : 'Failed to read file'
      }
    }

    setState(prev => ({
      tabs: [...prev.tabs, tab],
      activeTabId: tab.id,
    }))
  }, [state.tabs])

  const closeTab = useCallback((tabId: string) => {
    setState(prev => {
      const newTabs = prev.tabs.filter(t => t.id !== tabId)
      const wasActive = prev.activeTabId === tabId
      return {
        tabs: newTabs,
        activeTabId: wasActive ? null : prev.activeTabId, // fall back to chat
      }
    })
  }, [])

  const setActiveTab = useCallback((tabId: string | null) => {
    setState(prev => ({ ...prev, activeTabId: tabId }))
  }, [])

  const showChat = useCallback(() => {
    setState(prev => ({ ...prev, activeTabId: null }))
  }, [])

  return {
    tabs: state.tabs,
    activeTabId: state.activeTabId,
    openFile,
    closeTab,
    setActiveTab,
    showChat,
    isShowingChat: state.activeTabId === null,
  }
}
