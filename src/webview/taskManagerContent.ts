import { TaskManagerMode } from '../models/TaskManager';
import { taskStyles } from './templates/taskStyles';
import { taskLayout } from './templates/taskLayout';
import { getTaskScriptContent } from './templates/taskScriptTemplate';

export function getTaskManagerContent(initialMode: TaskManagerMode): string {
  const script = getTaskScriptContent(initialMode);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Task Manager</title>
  <style>
${taskStyles}
  </style>
</head>
<body>
${taskLayout}
${script}
</body>
</html>`;
}
