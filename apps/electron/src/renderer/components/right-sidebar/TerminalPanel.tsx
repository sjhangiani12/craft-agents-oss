/**
 * TerminalPanel - Run commands in session's worktree/working directory
 *
 * Simple command runner: type a command, hit Run, see streaming output.
 * No full terminal emulator — just spawn + pipe to <pre>.
 */

import * as React from 'react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Play, Square } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSession as useSessionData } from '@/context/AppShellContext'

const MAX_OUTPUT_LENGTH = 50_000

export interface TerminalPanelProps {
  sessionId?: string
}

export function TerminalPanel({ sessionId }: TerminalPanelProps) {
  const session = useSessionData(sessionId || '')
  const [command, setCommand] = useState('')
  const [output, setOutput] = useState('')
  const [status, setStatus] = useState<'idle' | 'running' | 'stopped'>('idle')
  const [exitCode, setExitCode] = useState<number | null>(null)
  const [terminalId, setTerminalId] = useState<string | null>(null)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState('')
  const outputRef = useRef<HTMLPreElement>(null)
  const autoScrollRef = useRef(true)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll output
  useEffect(() => {
    if (autoScrollRef.current && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [output])

  // Elapsed time ticker
  useEffect(() => {
    if (status !== 'running' || !startedAt) {
      return
    }
    const timer = setInterval(() => {
      const secs = Math.floor((Date.now() - startedAt) / 1000)
      const m = Math.floor(secs / 60)
      const s = secs % 60
      setElapsed(m > 0 ? `${m}m ${s}s` : `${s}s`)
    }, 1000)
    return () => clearInterval(timer)
  }, [status, startedAt])

  // Listen for terminal output and exit events
  useEffect(() => {
    const unsubOutput = window.electronAPI.onTerminalOutput((data) => {
      if (data.terminalId === terminalId) {
        setOutput((prev) => {
          const next = prev + data.chunk
          // Cap output to prevent memory issues
          return next.length > MAX_OUTPUT_LENGTH
            ? next.slice(next.length - MAX_OUTPUT_LENGTH)
            : next
        })
      }
    })

    const unsubExit = window.electronAPI.onTerminalExit((data) => {
      if (data.terminalId === terminalId) {
        setStatus('stopped')
        setExitCode(data.exitCode)
      }
    })

    return () => {
      unsubOutput()
      unsubExit()
    }
  }, [terminalId])

  // Handle scroll — pause auto-scroll when user scrolls up
  const handleScroll = useCallback(() => {
    if (!outputRef.current) return
    const el = outputRef.current
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    autoScrollRef.current = isAtBottom
  }, [])

  // Start command
  const handleStart = useCallback(async () => {
    if (!sessionId || !command.trim()) return

    setOutput('')
    setExitCode(null)
    setStatus('running')
    setStartedAt(Date.now())
    autoScrollRef.current = true

    try {
      const result = await window.electronAPI.terminalStart(sessionId, command.trim())
      setTerminalId(result.terminalId)
    } catch (err) {
      setOutput(`Error: ${err instanceof Error ? err.message : String(err)}\n`)
      setStatus('stopped')
      setExitCode(1)
    }
  }, [sessionId, command])

  // Stop command
  const handleStop = useCallback(() => {
    if (terminalId) {
      window.electronAPI.terminalStop(terminalId)
    }
  }, [terminalId])

  // Submit on Enter
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (status === 'running') {
        handleStop()
      } else {
        handleStart()
      }
    }
  }

  if (!sessionId) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground p-4">
        <p className="text-sm text-center">No session selected</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Command input */}
      <div className="shrink-0 px-3 pt-3 pb-2">
        <div className="flex items-center gap-1.5 rounded-lg bg-background border border-border px-2">
          <span className="text-muted-foreground text-xs select-none shrink-0">$</span>
          <input
            ref={inputRef}
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={session?.worktreeBranch ? 'pnpm dev --port $AGENT_PORT' : 'Enter command...'}
            disabled={status === 'running'}
            className="flex-1 bg-transparent text-sm font-mono py-2 outline-none placeholder:text-muted-foreground/50 disabled:opacity-50"
          />
          {status === 'running' ? (
            <button
              onClick={handleStop}
              className="shrink-0 p-1 rounded hover:bg-destructive/10 text-destructive transition-colors cursor-pointer"
              title="Stop"
            >
              <Square className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={handleStart}
              disabled={!command.trim()}
              className="shrink-0 p-1 rounded hover:bg-accent/10 text-accent transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default"
              title="Run (Enter)"
            >
              <Play className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Output */}
      <div className="flex-1 min-h-0 px-3 pb-2">
        <pre
          ref={outputRef}
          onScroll={handleScroll}
          className={cn(
            'h-full overflow-auto rounded-lg bg-[#1a1a1a] text-[#ccc] p-3',
            'text-[11px] leading-[1.5] font-mono whitespace-pre-wrap break-all',
            !output && 'flex items-center justify-center'
          )}
        >
          {output || (
            <span className="text-[#555] select-none text-xs">
              {status === 'idle' ? 'Output will appear here...' : 'Starting...'}
            </span>
          )}
        </pre>
      </div>

      {/* Status bar */}
      <div className="shrink-0 px-3 pb-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {status === 'running' && (
            <>
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              <span>Running</span>
              {elapsed && <span className="text-muted-foreground/60">{elapsed}</span>}
            </>
          )}
          {status === 'stopped' && exitCode !== null && (
            <>
              <span className={cn(
                'inline-block h-1.5 w-1.5 rounded-full',
                exitCode === 0 ? 'bg-green-500' : 'bg-red-500'
              )} />
              <span>Exited with code {exitCode}</span>
              {elapsed && <span className="text-muted-foreground/60">{elapsed}</span>}
            </>
          )}
          {status === 'idle' && (
            <span className="text-muted-foreground/60">Ready</span>
          )}
        </div>
      </div>
    </div>
  )
}
