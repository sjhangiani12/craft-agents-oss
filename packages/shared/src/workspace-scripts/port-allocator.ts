/**
 * Port Allocator
 *
 * Allocates non-overlapping port ranges for agent sessions.
 * Each session gets a base port calculated from the session index.
 */

import { createConnection } from 'net';

export class PortAllocator {
  private basePort: number;
  private increment: number;
  private allocated: Set<number> = new Set();

  constructor(basePort: number = 3000, increment: number = 10) {
    this.basePort = basePort;
    this.increment = increment;
  }

  /**
   * Allocate a port for a given session index.
   * Returns basePort + (sessionIndex * increment).
   */
  allocate(sessionIndex: number): number {
    const port = this.basePort + (sessionIndex * this.increment);
    this.allocated.add(port);
    return port;
  }

  /**
   * Find the next available port starting from startPort.
   * Checks if the port is actually free by attempting to connect.
   */
  async findNextAvailable(startPort: number): Promise<number> {
    let port = startPort;
    while (port < 65535) {
      if (!this.allocated.has(port) && await this.isPortFree(port)) {
        this.allocated.add(port);
        return port;
      }
      port++;
    }
    throw new Error(`No available port found starting from ${startPort}`);
  }

  /**
   * Release a previously allocated port.
   */
  release(port: number): void {
    this.allocated.delete(port);
  }

  private isPortFree(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = createConnection({ port, host: '127.0.0.1' });
      socket.once('connect', () => {
        socket.destroy();
        resolve(false); // Port is in use
      });
      socket.once('error', () => {
        socket.destroy();
        resolve(true); // Port is free
      });
      // Short timeout to avoid hanging
      socket.setTimeout(200, () => {
        socket.destroy();
        resolve(true); // Assume free on timeout
      });
    });
  }
}
