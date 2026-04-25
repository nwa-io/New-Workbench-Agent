export interface Model {
  id: string;
  name: string;
  desc: string;
}

export const models: Model[] = [
  { id: 'sonnet', name: 'Sonnet', desc: 'Balanced performance - best for most agents' },
  { id: 'opus', name: 'Opus', desc: 'Most capable for complex reasoning tasks' },
  { id: 'haiku', name: 'Haiku', desc: 'Fast and efficient for simple tasks' },
  { id: 'inherit', name: 'Inherit from parent', desc: 'Use the same model as the main conversation' }
];
