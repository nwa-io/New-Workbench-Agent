import { useTaskManager } from './store';
import { ListView } from './views/ListView';
import { CreateView } from './views/CreateView';
import { DetailView } from './views/DetailView';

function FilterIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

// Self-contained sparkle (Figma export): a star clipped to an angular conic
// gradient, with a fractal-noise grain overlay. Rendered as raw markup so the
// filter/clipPath/foreignObject structure is preserved verbatim.
const SPARKLE_SVG = `<svg width="36" height="46" viewBox="0 0 36 46" fill="none" xmlns="http://www.w3.org/2000/svg">
<g filter="url(#filter0_n_200_698)">
<g clip-path="url(#paint0_angular_200_698_clip_path)"><g transform="matrix(0.0126022 0 0 0.0268427 16.7697 29.2592)"><foreignObject x="-1196.34" y="-1196.34" width="2392.68" height="2392.68"><div xmlns="http://www.w3.org/1999/xhtml" style="background:conic-gradient(from 90deg,rgba(193, 181, 255, 1) 0deg,rgba(255, 255, 255, 1) 140.192deg,rgba(226, 194, 255, 1) 244.038deg,rgba(219, 243, 255, 1) 325.385deg,rgba(193, 181, 255, 1) 360deg);height:100%;width:100%;opacity:1"></div></foreignObject></g></g><path d="M19.0435 14.1543C19.4837 17.6022 20.426 21.1716 22.6274 23.373C24.8289 25.5744 28.3983 26.5159 31.8462 26.9561V29.0439C28.3983 29.4841 24.8289 30.4257 22.6274 32.627C20.426 34.8284 19.4837 38.3987 19.0435 41.8467H16.9565C16.5163 38.3987 15.574 34.8284 13.3726 32.627C11.1711 30.4257 7.60168 29.4841 4.15381 29.0439V26.9561C7.60173 26.5159 11.1711 25.5744 13.3726 23.373C15.574 21.1716 16.5163 17.6022 16.9565 14.1543H19.0435Z"></path>
</g>
<defs>
<filter id="filter0_n_200_698" x="0" y="10" width="36" height="36" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<feFlood flood-opacity="0" result="BackgroundImageFix"></feFlood>
<feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"></feBlend>
<feTurbulence type="fractalNoise" baseFrequency="2 2" stitchTiles="stitch" numOctaves="3" result="noise" seed="7719"></feTurbulence>
<feColorMatrix in="noise" type="luminanceToAlpha" result="alphaNoise"></feColorMatrix>
<feComponentTransfer in="alphaNoise" result="coloredNoise1">
<feFuncA type="discrete" tableValues="1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 "></feFuncA>
</feComponentTransfer>
<feComposite operator="in" in2="shape" in="coloredNoise1" result="noise1Clipped"></feComposite>
<feFlood flood-color="rgba(255, 255, 255, 0.15)" result="color1Flood"></feFlood>
<feComposite operator="in" in2="noise1Clipped" in="color1Flood" result="color1"></feComposite>
<feMerge result="effect1_noise_200_698">
<feMergeNode in="shape"></feMergeNode>
<feMergeNode in="color1"></feMergeNode>
</feMerge>
</filter>
<clipPath id="paint0_angular_200_698_clip_path"><path d="M19.0435 14.1543C19.4837 17.6022 20.426 21.1716 22.6274 23.373C24.8289 25.5744 28.3983 26.5159 31.8462 26.9561V29.0439C28.3983 29.4841 24.8289 30.4257 22.6274 32.627C20.426 34.8284 19.4837 38.3987 19.0435 41.8467H16.9565C16.5163 38.3987 15.574 34.8284 13.3726 32.627C11.1711 30.4257 7.60168 29.4841 4.15381 29.0439V26.9561C7.60173 26.5159 11.1711 25.5744 13.3726 23.373C15.574 21.1716 16.5163 17.6022 16.9565 14.1543H19.0435Z"></path></clipPath></defs>
</svg>`;

function SparkleIcon(): JSX.Element {
  return <span className="create-pill-sparkle" aria-hidden="true" dangerouslySetInnerHTML={{ __html: SPARKLE_SVG }} />;
}

function isFilterActive(filter: { taskId: string; pending: boolean; success: boolean; doing: boolean; task: boolean; bug: boolean; analysis: boolean }): boolean {
  return (
    filter.taskId.trim() !== '' ||
    !(filter.pending && filter.success && filter.doing) ||
    !(filter.task && filter.bug && filter.analysis)
  );
}

export function App(): JSX.Element {
  const { state, actions } = useTaskManager();
  const { view, mode, currentItem } = state;

  const crumbs: Array<{ label: string; target: 'list' | 'create' | 'detail' }> = [
    { label: 'Task Manager', target: 'list' }
  ];
  if (view === 'create') {
    crumbs.push({ label: 'Create', target: 'create' });
  } else if (view === 'detail' && currentItem) {
    crumbs.push({ label: currentItem.id, target: 'detail' });
  }

  function navigate(target: 'list' | 'create' | 'detail'): void {
    if (target === 'list') {
      actions.showListView();
    } else if (target === 'detail' && currentItem) {
      actions.showView('detail');
    } else if (target === 'create') {
      actions.showView('create');
    }
  }

  return (
    <div className="task-container">
      <header className="task-header">
        <nav className="task-breadcrumb" id="taskBreadcrumb">
          {crumbs.map((crumb, index) => {
            const isLast = index === crumbs.length - 1;
            return (
              <span key={crumb.target}>
                {index > 0 ? (
                  <span className="breadcrumb-separator" aria-hidden="true">
                    /
                  </span>
                ) : null}
                <button
                  className={`breadcrumb-link${isLast ? ' current' : ''}`}
                  type="button"
                  aria-current={isLast ? 'page' : undefined}
                  onClick={() => navigate(crumb.target)}
                >
                  {crumb.label}
                </button>
              </span>
            );
          })}
        </nav>
        <div className="task-header-actions">
          <button
            className="icon-button filter-icon-button"
            id="taskFilterHeaderBtn"
            type="button"
            title="Filter"
            hidden={view !== 'list' || mode !== 'task'}
            onClick={actions.openFilterDialog}
            style={isFilterActive(state.filter) ? { color: 'var(--vscode-focusBorder)' } : undefined}
          >
            <FilterIcon />
          </button>
          <button
            className="create-pill-button"
            id="taskCreateHeaderBtn"
            type="button"
            title="Create new task"
            hidden={view !== 'list'}
            onClick={actions.openCreateView}
          >
            <SparkleIcon />
            <span className="create-pill-label">Create new task</span>
          </button>
        </div>
      </header>

      {view === 'list' ? <ListView /> : null}
      {view === 'create' ? <CreateView /> : null}
      {view === 'detail' ? <DetailView /> : null}
    </div>
  );
}
