/**
 * Workflow Scheduler
 * Checks saved workflows every minute and executes them when scheduled time arrives
 */

import cron from 'node-cron';
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
    interval?: string; // '5m', '30m', '1h', '6h', '24h'
  };
  createdAt: string;
  updatedAt: string;
}

class WorkflowScheduler {
  private isRunning = false;
  private cronJob: cron.ScheduledTask | null = null;

  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Start the scheduler - runs every minute
   */
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

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    this.isRunning = false;
    console.log('[Scheduler] Scheduler stopped');
  }

  /**
   * Check all saved workflows and execute those that are ready
   */
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

          // If recurring, update executeAt to next interval
          if (workflow.schedule.type === 'recurring' && workflow.schedule.interval) {
            await this.updateNextExecution(workflow);
          } else if (workflow.schedule.type === 'deferred') {
            // One-time execution - disable after running
            await this.disableWorkflow(workflow);
          }
        }
      }
    } catch (error: any) {
      console.error('[Scheduler] Error checking workflows:', error);
    }
  }

  /**
   * Load all saved workflows that have schedules enabled
   */
  private async loadScheduledWorkflows(): Promise<ScheduledWorkflow[]> {
    const workflowsDir = path.join(process.cwd(), 'data', 'workflows');

    if (!existsSync(workflowsDir)) {
      return [];
    }

    const files = await readdir(workflowsDir);
    const jsonFiles = files.filter(file => file.endsWith('.json'));

    const workflows: ScheduledWorkflow[] = [];

    for (const file of jsonFiles) {
      try {
        const filePath = path.join(workflowsDir, file);
        const content = await readFile(filePath, 'utf-8');
        const workflow = JSON.parse(content) as ScheduledWorkflow;

        if (workflow.schedule && workflow.schedule.enabled) {
          workflows.push(workflow);
        }
      } catch (error) {
        console.error(`[Scheduler] Error reading workflow file ${file}:`, error);
      }
    }

    return workflows;
  }

  /**
   * Execute a workflow by calling the execute API endpoint
   */
  private async executeWorkflow(workflow: ScheduledWorkflow) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3005';
      const url = `${baseUrl}/api/workflows/execute`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: workflow.nodes,
          edges: workflow.edges,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error(`[Scheduler] Failed to execute workflow ${workflow.id}:`, error);
        return;
      }

      // For streaming response, we just log that it started
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

  /**
   * Calculate next execution time based on interval
   */
  private calculateNextExecution(interval: string): Date {
    const now = new Date();
    const next = new Date(now);

    // Parse interval: '5m', '30m', '1h', '6h', '24h'
    const match = interval.match(/^(\d+)([mh])$/);
    if (!match) {
      // Default to 1 hour if invalid
      next.setHours(next.getHours() + 1);
      return next;
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    if (unit === 'm') {
      next.setMinutes(next.getMinutes() + value);
    } else if (unit === 'h') {
      next.setHours(next.getHours() + value);
    }

    return next;
  }

  /**
   * Update workflow file with next execution time
   */
  private async updateNextExecution(workflow: ScheduledWorkflow) {
    try {
      const nextTime = this.calculateNextExecution(workflow.schedule.interval!);
      workflow.schedule.executeAt = nextTime.toISOString();
      workflow.updatedAt = new Date().toISOString();

      const workflowsDir = path.join(process.cwd(), 'data', 'workflows');
      const filePath = path.join(workflowsDir, `${workflow.id}.json`);
      await writeFile(filePath, JSON.stringify(workflow, null, 2), 'utf-8');

      console.log(`[Scheduler] Updated ${workflow.name} - next execution: ${nextTime.toISOString()}`);
    } catch (error: any) {
      console.error(`[Scheduler] Error updating workflow ${workflow.id}:`, error);
    }
  }

  /**
   * Disable workflow after one-time execution
   */
  private async disableWorkflow(workflow: ScheduledWorkflow) {
    try {
      workflow.schedule.enabled = false;
      workflow.updatedAt = new Date().toISOString();

      const workflowsDir = path.join(process.cwd(), 'data', 'workflows');
      const filePath = path.join(workflowsDir, `${workflow.id}.json`);
      await writeFile(filePath, JSON.stringify(workflow, null, 2), 'utf-8');

      console.log(`[Scheduler] Disabled one-time workflow: ${workflow.name}`);
    } catch (error: any) {
      console.error(`[Scheduler] Error disabling workflow ${workflow.id}:`, error);
    }
  }
}

// Singleton instance
let schedulerInstance: WorkflowScheduler | null = null;

export function getWorkflowScheduler(): WorkflowScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new WorkflowScheduler();
  }
  return schedulerInstance;
}
