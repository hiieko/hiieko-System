#!/usr/bin/env node

/**
 * Prevent multiple Next.js development servers from sharing web/.next.
 *
 * The root and workspace npm scripts both reach this guard before starting
 * Next. The lock is created atomically so concurrent starts cannot race.
 */

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const repoRoot = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const webRoot = path.join(repoRoot, 'web');
const lockPath = path.join(repoRoot, '.web-dev.lock');

function processExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireLock() {
  try {
    const fd = fs.openSync(lockPath, 'wx');
    fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    fs.closeSync(fd);
    return true;
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;

    try {
      const existing = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
      if (existing?.pid && processExists(existing.pid)) {
        console.error(
          `[web:dev] A development server is already running (PID ${existing.pid}). ` +
          'Stop it before starting another one so both processes do not share web/.next.',
        );
        return false;
      }
    } catch {
      // A malformed/stale lock is safe to replace below.
    }

    fs.rmSync(lockPath, { force: true });
    return acquireLock();
  }
}

function releaseLock() {
  try {
    const existing = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    if (existing?.pid === process.pid) fs.rmSync(lockPath, { force: true });
  } catch {
    fs.rmSync(lockPath, { force: true });
  }
}

if (!acquireLock()) process.exit(1);

const require = createRequire(import.meta.url);
const nextBin = require.resolve('next/dist/bin/next');
const child = spawn(process.execPath, [nextBin, 'dev'], {
  cwd: webRoot,
  stdio: 'inherit',
});

const shutdown = (signal) => {
  if (!child.killed) child.kill(signal);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('exit', releaseLock);

child.on('error', (error) => {
  console.error('[web:dev] Failed to start Next.js:', error);
  releaseLock();
  process.exitCode = 1;
});

child.on('exit', (code, signal) => {
  releaseLock();
  process.exitCode = signal ? 1 : (code ?? 1);
});
