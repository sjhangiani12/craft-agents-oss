/**
 * TerminalManager - Manages spawned processes per session
 *
 * Spawns commands via child_process.spawn with shell: true.
 * Streams stdout/stderr to renderer via callback (batched every 50ms).
 * Strips ANSI escape codes for clean <pre> rendering.
 */

import { spawn, type ChildProcess } from 'child_process'
import { debug } from '@craft-agent/shared/utils'

const ANSI_REGEX = /\x1b\[[0-9;]*[a-zA-Z]|\x1b\].*?\x07|\x1b\[.*?[@-~]/g

export interface TerminalProcess {
  id: string
  sessionId: string
  process: ChildProcess
  command: string
  startedAt: number
}

export interface TerminalEvents {
  onOutput: (terminalId: string, chunk: string) => void
  onExit: (terminalId: string, exitCode: number | null) => void
}

export class TerminalManager {
  private terminals: Map<string, TerminalProcess> = new Map()
  private outputBuffers: Map<string, string> = new Map()
  private flushTimers: Map<string, ReturnType<typeof setInterval>> = new Map()
  private idCounter = 0
  private events: TerminalEvents

  constructor(events: TerminalEvents) {
    this.events = events
  }

  /**
   * Start a command in a session's working directory.
   * Returns a terminal ID for tracking.
   */
  start(sessionId: string, command: string, cwd: string, env?: Record<string, string>): string {
    const id = `term_${++this.idCounter}_${Date.now()}`

    const mergedEnv = { ...process.env, ...env }

    const child = spawn(command, {
      shell: true,
      cwd,
      env: mergedEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    const terminal: TerminalProcess = {
      id,
      sessionId,
      process: child,
      command,
      startedAt: Date.now(),
    }

    this.terminals.set(id, terminal)
    this.outputBuffers.set(id, '')

    // Buffer output and flush every 50ms
    const flushTimer = setInterval(() => {
      this.flushOutput(id)
    }, 50)
    this.flushTimers.set(id, flushTimer)

    // Pipe stdout
    child.stdout?.on('data', (data: Buffer) => {
      const text = this.stripAnsi(data.toString('utf-8'))
      const buffer = this.outputBuffers.get(id) ?? ''
      this.outputBuffers.set(id, buffer + text)
    })

    // Pipe stderr
    child.stderr?.on('data', (data: Buffer) => {
      const text = this.stripAnsi(data.toString('utf-8'))
      const buffer = this.outputBuffers.get(id) ?? ''
      this.outputBuffers.set(id, buffer + text)
    })

    // Handle exit
    child.on('exit', (code) => {
      // Flush remaining output
      this.flushOutput(id)
      this.cleanupTimer(id)
      this.terminals.delete(id)
      this.events.onExit(id, code)
      debug(`[terminal] Process ${id} exited with code ${code}`)
    })

    child.on('error', (err) => {
      this.flushOutput(id)
      this.cleanupTimer(id)
      this.terminals.delete(id)
      this.events.onOutput(id, `\nError: ${err.message}\n`)
      this.events.onExit(id, 1)
      debug(`[terminal] Process ${id} error:`, err)
    })

    debug(`[terminal] Started ${id}: ${command} in ${cwd}`)
    return id
  }

  /**
   * Write data to a terminal's stdin.
   */
  write(terminalId: string, data: string): void {
    const terminal = this.terminals.get(terminalId)
    if (terminal?.process.stdin?.writable) {
      terminal.process.stdin.write(data)
    }
  }

  /**
   * Stop a terminal process (SIGTERM, then SIGKILL after 5s).
   */
  stop(terminalId: string): void {
    const terminal = this.terminals.get(terminalId)
    if (!terminal) return

    const child = terminal.process
    child.kill('SIGTERM')

    // Force kill after 5s if still running
    setTimeout(() => {
      if (!child.killed) {
        child.kill('SIGKILL')
      }
    }, 5000)

    debug(`[terminal] Stopping ${terminalId}`)
  }

  /**
   * Kill all terminals for a session (called on session delete).
   */
  dispose(sessionId: string): void {
    for (const [id, terminal] of this.terminals) {
      if (terminal.sessionId === sessionId) {
        this.stop(id)
      }
    }
  }

  /**
   * Get terminal info for a session.
   */
  getForSession(sessionId: string): TerminalProcess | undefined {
    for (const terminal of this.terminals.values()) {
      if (terminal.sessionId === sessionId) {
        return terminal
      }
    }
    return undefined
  }

  /**
   * Clean up all terminals (app shutdown).
   */
  disposeAll(): void {
    for (const id of this.terminals.keys()) {
      this.stop(id)
    }
  }

  private flushOutput(id: string): void {
    const buffer = this.outputBuffers.get(id)
    if (buffer && buffer.length > 0) {
      this.outputBuffers.set(id, '')
      this.events.onOutput(id, buffer)
    }
  }

  private cleanupTimer(id: string): void {
    const timer = this.flushTimers.get(id)
    if (timer) {
      clearInterval(timer)
      this.flushTimers.delete(id)
    }
    this.outputBuffers.delete(id)
  }

  private stripAnsi(text: string): string {
    return text.replace(ANSI_REGEX, '')
  }
}
