export const departmentIcons: Record<string, string> = {
  'design': '🎨',
  'engineering': '⚙️',
  'marketing': '📢',
  'product': '📊',
  'project-management': '📋',
  'studio-operations': '🏢',
  'testing': '✅'
};

export interface Department {
  name: string;
  description: string;
  agents: string[];
}

export const DEPARTMENTS: Record<string, Department> = {
  'design': {
    name: 'Design',
    description: 'Visual design, UX research, and brand consistency',
    agents: [
      'brand-guardian',
      'ui-designer',
      'ux-researcher',
      'visual-storyteller',
      'whimsy-injector',
    ],
  },
  'engineering': {
    name: 'Engineering',
    description: 'Backend, frontend, mobile, AI, and DevOps engineering',
    agents: [
      'ai-engineer',
      'backend-architect',
      'devops-automator',
      'frontend-developer',
      'mobile-app-builder',
      'rapid-prototyper',
      'test-writer-fixer',
    ],
  },
  'marketing': {
    name: 'Marketing',
    description: 'Content, growth, and social media engagement',
    agents: [
      'app-store-optimizer',
      'content-creator',
      'growth-hacker',
      'instagram-curator',
      'reddit-community-builder',
      'tiktok-strategist',
      'twitter-engager',
    ],
  },
  'product': {
    name: 'Product',
    description: 'Feedback synthesis, prioritization, and trend research',
    agents: [
      'feedback-synthesizer',
      'sprint-prioritizer',
      'trend-researcher',
    ],
  },
  'project-management': {
    name: 'Project Management',
    description: 'Experimentation, shipping, and cross-team production',
    agents: [
      'experiment-tracker',
      'project-shipper',
      'studio-producer',
    ],
  },
  'studio-operations': {
    name: 'Studio Operations',
    description: 'Analytics, finance, infrastructure, legal, and support',
    agents: [
      'analytics-reporter',
      'finance-tracker',
      'infrastructure-maintainer',
      'legal-compliance-checker',
      'support-responder',
    ],
  },
  'testing': {
    name: 'Testing',
    description: 'API, performance, and quality testing',
    agents: [
      'api-tester',
      'performance-benchmarker',
      'test-results-analyzer',
      'tool-evaluator',
      'workflow-optimizer',
    ],
  },
};
