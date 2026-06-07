import { createRoot } from 'react-dom/client';
import type { TaskManagerMode } from '@nwa/workflow-sdk';
import { TaskManagerProvider } from './store';
import { App } from './App';
import './styles.css';

const container = document.getElementById('root');
const bootstrap = (window as unknown as { __NWA_BOOTSTRAP__?: { mode?: TaskManagerMode } }).__NWA_BOOTSTRAP__;
const initialMode: TaskManagerMode = bootstrap?.mode || 'task';

if (container) {
  createRoot(container).render(
    <TaskManagerProvider initialMode={initialMode}>
      <App />
    </TaskManagerProvider>
  );
}
