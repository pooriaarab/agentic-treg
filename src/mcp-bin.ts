#!/usr/bin/env node
import { startMcp } from './mcp.js';
import { safeMessage } from './index.js';
startMcp().catch(error => { console.error(safeMessage(error)); process.exitCode = 1; });
