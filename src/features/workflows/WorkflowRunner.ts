import * as vscode from 'vscode';
import { WorkflowBlock, WorkflowFile, WorkflowParallelBlock, WorkflowStepBlock, WorkflowStatus } from './types';

export type StatusListener = (blockId: string, status: WorkflowStatus) => void;

export class WorkflowRunner {
  private output: vscode.OutputChannel;

  constructor(output?: vscode.OutputChannel) {
    this.output = output ?? vscode.window.createOutputChannel('NWA Workflow');
  }

  async run(wf: WorkflowFile, onStatus: StatusListener): Promise<WorkflowFile> {
    this.output.show(true);
    this.output.appendLine(`▶ Running workflow "${wf.name}" (${wf.blocks.length} blocks)`);

    this.resetStatuses(wf, onStatus);

    for (const block of wf.blocks) {
      if (block.kind === 'step') {
        await this.runStep(block, onStatus);
      } else {
        await this.runParallel(block, onStatus);
      }
    }

    this.output.appendLine(`✔ Workflow "${wf.name}" finished`);
    return wf;
  }

  private resetStatuses(wf: WorkflowFile, onStatus: StatusListener): void {
    const reset = (b: WorkflowBlock) => {
      b.status = 'idle';
      onStatus(b.id, 'idle');
      if (b.kind === 'parallel') {
        for (const c of b.children) {
          c.status = 'idle';
          onStatus(c.id, 'idle');
        }
      }
    };
    for (const b of wf.blocks) {
      reset(b);
    }
  }

  private async runStep(step: WorkflowStepBlock, onStatus: StatusListener): Promise<void> {
    step.status = 'running';
    onStatus(step.id, 'running');
    this.output.appendLine(`  ↳ [${step.stepType}] ${step.title}`);
    await this.sleep(300);
    step.status = 'success';
    onStatus(step.id, 'success');
  }

  private async runParallel(group: WorkflowParallelBlock, onStatus: StatusListener): Promise<void> {
    group.status = 'running';
    onStatus(group.id, 'running');
    this.output.appendLine(`  ↳ parallel: ${group.title} (${group.children.length} children)`);
    await Promise.all(group.children.map(c => this.runStep(c, onStatus)));
    group.status = 'success';
    onStatus(group.id, 'success');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  dispose(): void {
    this.output.dispose();
  }
}
