/**
 * Workflow Scheduler
 * Checks saved workflows every minute and executes them when scheduled time arrives
 */

import cron, { ScheduledTask } from 'node-cron';
import { readdir, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

interface ScheduledWorkflow {
  id: string;
  name: string;
  nodes: any[];
  edges: any[];
  schedule: {
    type: 'deferred' | 'recurring' | 'none';
    enabled: boolean;
    executeAt?: string; // ISO timestamp
    interval?: string;  // '5m', '30m', '1h', '6h', '24h'
  };
  createdAt: string;
  updatedAt: string;
}

class WorkflowScheduler {
  private isRunning = false;
  private cronJob: ScheduledTask | null = null; // ✅ Fixed type

  get running(): boolean {
    return this.isRunning;
  }

  start() {
    if (this.isRunning) {
      console.log('[Scheduler] Already running');
      return;
    }

    console.log('[Scheduler] Starting workflow scheduler...');

    // Run every minute: * * * * *
    this.cronJob = cron.schedule('* * * * *', async () => {
      await this.checkAndExecuteWorkflows();
    });

    this.isRunning = true;

    // Also check immediately on startup
    this.checkAndExecuteWorkflows();

    console.log('[Scheduler] Scheduler started - checking workflows every minute');
  }

  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    this.isRunning = false;
    console.log('[Scheduler] Scheduler stopped');
  }

  private async checkAndExecuteWorkflows() {
    try {
      const workflows = await this.loadScheduledWorkflows();
      const now = new Date();

      for (const workflow of workflows) {
        if (!workflow.schedule.enabled) continue;
        if (!workflow.schedule.executeAt) continue;

        const executeAt = new Date(workflow.schedule.executeAt);

        if (executeAt <= now) {
          console.log(`[Scheduler] Executing workflow: ${workflow.name} (${workflow.id})`);
          await this.executeWorkflow(workflow);

          if (workflow.schedule.type === 'recurring' && workflow.schedule.interval) {
            await this.updateNextExecution(workflow);
          } else if (workflow.schedule.type === 'deferred') {
            await this.disableWorkflow(workflow);
          }
        }
      }
    } catch (error: any) {
      console.error('[Scheduler] Error checking workflows:', error);
    }
  }

  private async loadScheduledWorkflows(): Promise<ScheduledWorkflow[]> {
    const workflowsDir = path.join(process.cwd(), 'data', 'workflows');

    if (!existsSync(workflowsDir)) return [];

    const files = await readdir(workflowsDir);
    const workflows: ScheduledWorkflow[] = [];

    for (const file of files.filter(f => f.endsWith('.json'))) {
      try {
        const content = await readFile(path.join(workflowsDir, file), 'utf-8');
        const workflow = JSON.parse(content) as ScheduledWorkflow;
        if (workflow.schedule.enabled) workflows.push(workflow);
      } catch (error) {
        console.error(`[Scheduler] Error reading workflow file ${file}:`, error);
      }
    }

    return workflows;
  }

  private async executeWorkflow(workflow: ScheduledWorkflow) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3005';
      const url = `${baseUrl}/api/workflows/execute`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes: workflow.nodes, edges: workflow.edges }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error(`[Scheduler] Failed to execute workflow ${workflow.id}:`, error);
        return;
      }

      const contentType = response.headers.get('content-type');
      if (contentType?.includes('text/event-stream')) {
        console.log(`[Scheduler] Workflow ${workflow.name} execution started (streaming)`);
      } else {
        const result = await response.json();
        console.log(`[Scheduler] Workflow ${workflow.name} executed:`, {
          success: result.success,
          machineId: result.result?.machineId,
          hasWorkOrder: !!result.result?.workOrderData,
        });
      }
    } catch (error: any) {
      console.error(`[Scheduler] Error executing workflow ${workflow.id}:`, error.message);
    }
  }

  private calculateNextExecution(interval: string): Date {
    const now = new Date();
    const next = new Date(now);
    const match = interval.match(/^(\d+)([mh])$/);

    if (!match) {
      next.setHours(next.getHours() + 1);
      return next;
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    if (unit === 'm') next.setMinutes(next.getMinutes() + value);
    else if (unit === 'h') next.setHours(next.getHours() + value);

    return next;
  }

  private async updateNextExecution(workflow: ScheduledWorkflow) {
    try {
      const nextTime = this.calculateNextExecution(workflow.schedule.interval!);
      workflow.schedule.executeAt = nextTime.toISOString();
      workflow.updatedAt = new Date().toISOString();

      await writeFile(
        path.join(process.cwd(), 'data', 'workflows', `${workflow.id}.json`),
        JSON.stringify(workflow, null, 2),
        'utf-8'
      );

      console.log(`[Scheduler] Updated ${workflow.name} - next execution: ${nextTime.toISOString()}`);
    } catch (error: any) {
      console.error(`[Scheduler] Error updating workflow ${workflow.id}:`, error);
    }
  }

  private async disableWorkflow(workflow: ScheduledWorkflow) {
    try {
      workflow.schedule.enabled = false;
      workflow.updatedAt = new Date().toISOString();

      await writeFile(
        path.join(process.cwd(), 'data', 'workflows', `${workflow.id}.json`),
        JSON.stringify(workflow, null, 2),
        'utf-8'
      );

      console.log(`[Scheduler] Disabled one-time workflow: ${workflow.name}`);
    } catch (error: any) {
      console.error(`[Scheduler] Error disabling workflow ${workflow.id}:`, error);
    }
  }
}

// Singleton
let schedulerInstance: WorkflowScheduler | null = null;

export function getWorkflowScheduler(): WorkflowScheduler {
  if (!schedulerInstance) schedulerInstance = new WorkflowScheduler();
  return schedulerInstance;
}
