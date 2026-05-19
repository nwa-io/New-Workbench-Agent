type UtilityMap = Record<string, string>;

// Keep Tailwind-style composition local because this webview injects CSS inline.
/* eslint-disable @typescript-eslint/naming-convention -- Utility keys intentionally mirror Tailwind class names. */
const staticUtilities: UtilityMap = {
  'absolute': 'position: absolute;',
  'relative': 'position: relative;',
  'static': 'position: static;',
  'fixed': 'position: fixed;',
  'block': 'display: block;',
  'inline-block': 'display: inline-block;',
  'flex': 'display: flex;',
  'inline-flex': 'display: inline-flex;',
  'grid': 'display: grid;',
  'hidden': 'display: none;',
  'box-border': 'box-sizing: border-box;',
  'items-start': 'align-items: flex-start;',
  'items-center': 'align-items: center;',
  'items-end': 'align-items: flex-end;',
  'items-stretch': 'align-items: stretch;',
  'justify-start': 'justify-content: flex-start;',
  'justify-center': 'justify-content: center;',
  'justify-between': 'justify-content: space-between;',
  'justify-end': 'justify-content: flex-end;',
  'content-center': 'align-content: center;',
  'self-start': 'align-self: flex-start;',
  'self-center': 'align-self: center;',
  'flex-1': 'flex: 1 1 0%;',
  'flex-none': 'flex: none;',
  'flex-shrink-0': 'flex-shrink: 0;',
  'flex-col': 'flex-direction: column;',
  'flex-row': 'flex-direction: row;',
  'flex-wrap': 'flex-wrap: wrap;',
  'grid-rows-auto': 'grid-template-rows: auto;',
  'm-0': 'margin: 0;',
  'mx-auto': 'margin-left: auto; margin-right: auto;',
  'my-auto': 'margin-top: auto; margin-bottom: auto;',
  'p-0': 'padding: 0;',
  'border-none': 'border: none;',
  'border-transparent': 'border-color: transparent;',
  'border-solid': 'border-style: solid;',
  'border-dashed': 'border-style: dashed;',
  'rounded': 'border-radius: 4px;',
  'rounded-md': 'border-radius: 6px;',
  'rounded-lg': 'border-radius: 8px;',
  'rounded-xl': 'border-radius: 12px;',
  'rounded-full': 'border-radius: 999px;',
  'bg-transparent': 'background: transparent;',
  'text-left': 'text-align: left;',
  'text-center': 'text-align: center;',
  'text-right': 'text-align: right;',
  'font-vscode': 'font-family: var(--vscode-font-family);',
  'font-editor': 'font-family: var(--vscode-editor-font-family);',
  'font-inherit': 'font-family: inherit;',
  'font-normal': 'font-weight: 400;',
  'font-medium': 'font-weight: 500;',
  'font-semibold': 'font-weight: 600;',
  'font-bold': 'font-weight: 700;',
  'uppercase': 'text-transform: uppercase;',
  'italic': 'font-style: italic;',
  'leading-none': 'line-height: 1;',
  'list-none': 'list-style: none;',
  'overflow-hidden': 'overflow: hidden;',
  'overflow-auto': 'overflow: auto;',
  'overflow-y-auto': 'overflow-y: auto;',
  'whitespace-nowrap': 'white-space: nowrap;',
  'whitespace-normal': 'white-space: normal;',
  'whitespace-pre-wrap': 'white-space: pre-wrap;',
  'text-ellipsis': 'text-overflow: ellipsis;',
  'break-words': 'word-break: break-word;',
  'resize-y': 'resize: vertical;',
  'outline-none': 'outline: none;',
  'cursor-pointer': 'cursor: pointer;',
  'cursor-default': 'cursor: default;',
  'cursor-not-allowed': 'cursor: not-allowed;',
  'select-none': 'user-select: none;',
  'pointer-events-none': 'pointer-events: none;',
  'fill-none': 'fill: none;',
  'fill-current': 'fill: currentColor;',
  'stroke-current': 'stroke: currentColor;',
  'stroke-round': 'stroke-linecap: round; stroke-linejoin: round;',
  'stroke-none': 'stroke: none;',
};
/* eslint-enable @typescript-eslint/naming-convention */

function decodeValue(value: string): string {
  return value.replace(/_/g, ' ');
}

function isColorValue(value: string): boolean {
  return /^(#|rgb|hsl|var\(|transparent|currentColor|inherit)/.test(value);
}

function arbitraryUtility(className: string): string | undefined {
  const match = className.match(/^([a-z-]+)-\[(.+)]$/);
  if (!match) {
    return undefined;
  }

  const [, prefix, rawValue] = match;
  const value = decodeValue(rawValue);

  switch (prefix) {
    case 'accent':
      return `accent-color: ${value};`;
    case 'basis':
      return `flex-basis: ${value};`;
    case 'bg':
      return `background: ${value};`;
    case 'border':
      return `border: ${value};`;
    case 'border-b':
      return `border-bottom: ${value};`;
    case 'border-l':
      return `border-left: ${value};`;
    case 'border-r':
      return `border-right: ${value};`;
    case 'border-t':
      return `border-top: ${value};`;
    case 'border-color':
      return `border-color: ${value};`;
    case 'bottom':
      return `bottom: ${value};`;
    case 'color':
      return `color: ${value};`;
    case 'content':
      return `content: ${value};`;
    case 'duration':
      return `transition-duration: ${value};`;
    case 'fill':
      return `fill: ${value};`;
    case 'flex':
      return `flex: ${value};`;
    case 'font':
      return /^var\(/.test(value) || value.includes(',')
        ? `font-family: ${value};`
        : `font-weight: ${value};`;
    case 'gap':
      return `gap: ${value};`;
    case 'grid-cols':
      return `grid-template-columns: ${value};`;
    case 'grid-rows':
      return `grid-template-rows: ${value};`;
    case 'h':
      return `height: ${value};`;
    case 'inset':
      return `inset: ${value};`;
    case 'left':
      return `left: ${value};`;
    case 'leading':
      return `line-height: ${value};`;
    case 'm':
      return `margin: ${value};`;
    case 'max-h':
      return `max-height: ${value};`;
    case 'max-w':
      return `max-width: ${value};`;
    case 'mb':
      return `margin-bottom: ${value};`;
    case 'min-h':
      return `min-height: ${value};`;
    case 'min-w':
      return `min-width: ${value};`;
    case 'ml':
      return `margin-left: ${value};`;
    case 'mr':
      return `margin-right: ${value};`;
    case 'mt':
      return `margin-top: ${value};`;
    case 'opacity':
      return `opacity: ${value};`;
    case 'outline':
      return `outline: ${value};`;
    case 'outline-offset':
      return `outline-offset: ${value};`;
    case 'p':
      return `padding: ${value};`;
    case 'pb':
      return `padding-bottom: ${value};`;
    case 'pl':
      return `padding-left: ${value};`;
    case 'pr':
      return `padding-right: ${value};`;
    case 'pt':
      return `padding-top: ${value};`;
    case 'px':
      return `padding-left: ${value}; padding-right: ${value};`;
    case 'py':
      return `padding-top: ${value}; padding-bottom: ${value};`;
    case 'right':
      return `right: ${value};`;
    case 'rotate':
      return `transform: rotate(${value});`;
    case 'rounded':
      return `border-radius: ${value};`;
    case 'shadow':
      return `box-shadow: ${value};`;
    case 'size':
      return `width: ${value}; height: ${value};`;
    case 'stroke':
      return `stroke: ${value};`;
    case 'stroke-dasharray':
      return `stroke-dasharray: ${value};`;
    case 'stroke-dashoffset':
      return `stroke-dashoffset: ${value};`;
    case 'stroke-width':
      return `stroke-width: ${value};`;
    case 'text':
      return isColorValue(value) ? `color: ${value};` : `font-size: ${value};`;
    case 'top':
      return `top: ${value};`;
    case 'tracking':
      return `letter-spacing: ${value};`;
    case 'transform':
      return `transform: ${value};`;
    case 'transition':
      return `transition: ${value};`;
    case 'translate-y':
      return `transform: translateY(${value});`;
    case 'w':
      return `width: ${value};`;
    case 'z':
      return `z-index: ${value};`;
    default:
      return undefined;
  }
}

function declarations(classes: string): string {
  return classes.trim().split(/\s+/).filter(Boolean).map(className => {
    const declaration = staticUtilities[className] ?? arbitraryUtility(className);
    if (!declaration) {
      throw new Error(`Unknown task style utility: ${className}`);
    }

    return `  ${declaration}\n`;
  }).join('');
}

function rule(selector: string, classes: string, extra = ''): string {
  return `${selector} {\n${declarations(classes)}${extra}}\n`;
}

function raw(css: string): string {
  return css.trim();
}

export const taskStyles = [
  rule('*', 'm-0 p-0 box-border'),
  rule('body', 'font-vscode text-[var(--vscode-foreground)] bg-[var(--vscode-editor-background)] p-[20px]'),
  rule('button', 'p-[10px_16px] bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] border-none rounded cursor-pointer font-inherit text-[13px] font-medium'),
  rule('button:hover:not(:disabled)', 'bg-[var(--vscode-button-hoverBackground)]'),
  rule('button:disabled', 'cursor-not-allowed opacity-[0.55]'),
  rule('button.secondary', 'bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)]'),
  rule('button.secondary:hover:not(:disabled)', 'bg-[var(--vscode-button-secondaryHoverBackground)]'),
  raw('[hidden] {\n  display: none !important;\n}'),

  rule('.task-container', 'max-w-[1200px] mx-auto'),
  rule('.task-header', 'flex items-center justify-between gap-[16px] mb-[20px]'),
  rule('.task-header-actions', 'flex items-center justify-end flex-wrap gap-[8px]'),
  rule('.task-breadcrumb', 'flex min-w-[0] items-center flex-wrap gap-[8px]'),
  rule('.breadcrumb-link', 'min-w-[0] overflow-hidden p-0 text-[var(--vscode-textLink-foreground)] bg-transparent border-none text-[28px] font-bold leading-[1.2] text-left text-ellipsis whitespace-nowrap'),
  rule('.breadcrumb-link:hover:not(:disabled)', 'text-[var(--vscode-textLink-activeForeground)] bg-transparent'),
  rule('.breadcrumb-link.current', 'text-[var(--vscode-editor-foreground)] cursor-default'),
  rule('.breadcrumb-separator', 'text-[var(--vscode-descriptionForeground)] text-[22px] leading-none'),
  rule('h1', 'text-[var(--vscode-editor-foreground)] text-[28px] leading-[1.2] mb-[8px]'),
  rule('h2', 'text-[var(--vscode-editor-foreground)] text-[16px] leading-[1.3]'),
  rule('.task-subtitle, .block-meta, .detail-copy, .empty-state, .document-path, .upload-status', 'text-[var(--vscode-descriptionForeground)] text-[13px] leading-[1.5]'),

  rule('.mode-switch, .item-type-switch, .figma-tabs, .markdown-mode-switch', 'inline-flex p-[2px] bg-[var(--vscode-input-background)] border-[1px_solid_var(--vscode-input-border)] rounded-md'),
  rule('.mode-switch', 'flex-shrink-0'),
  rule('.item-type-switch, .figma-tabs', 'w-[100%] mb-[16px]'),
  rule('.markdown-mode-switch', 'self-start'),
  rule('.mode-button, .item-type-button, .figma-tab, .markdown-mode-button', 'bg-transparent text-[var(--vscode-foreground)]'),
  rule('.mode-button', 'min-w-[86px]'),
  rule('.item-type-button, .figma-tab', 'flex-1'),
  rule('.markdown-mode-button', 'min-w-[84px] p-[8px_12px]'),
  rule('.mode-button.active, .item-type-button.active, .figma-tab.active, .markdown-mode-button.active', 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]'),

  rule('.task-list-view, .task-create-view, .figma-panel', 'block'),
  raw('.figma-panel[hidden] {\n  display: none;\n}'),
  rule('.task-list-block', 'pt-[12px]'),
  rule('.task-list-toolbar', 'flex min-h-[46px] items-start justify-start flex-wrap gap-[10px] mb-[12px]'),
  rule('.task-list-status', 'basis-[100%] min-w-[120px] text-[var(--vscode-descriptionForeground)] text-[13px] leading-[1.5]'),
  rule('.task-filter-toolbar', 'flex flex-1 min-w-[0] items-start justify-start flex-wrap gap-[12px]'),
  rule('.task-filter-chips', 'flex flex-1 min-w-[0] items-start justify-start flex-wrap gap-[10px]'),
  rule('.task-filter-chip', 'inline-flex max-w-[280px] min-h-[36px] items-center gap-[7px] overflow-hidden p-[4px_5px_4px_8px] text-[#202124] bg-[#f8f9fa] border-[1px_solid_rgba(60,_64,_67,_0.14)] rounded-full shadow-[0_1px_2px_rgba(60,_64,_67,_0.18)]'),
  rule('.task-filter-chip-leading', 'inline-flex size-[24px] flex-none items-center justify-center text-[#ffffff] rounded-full overflow-hidden'),
  rule('.task-filter-chip-leading svg', 'size-[16px] fill-none pointer-events-none stroke-current stroke-round stroke-width-[2]'),
  rule('.task-filter-chip-leading.task-id', 'bg-[#57606a]'),
  rule('.task-filter-chip-leading.status-pending', 'bg-[#8b949e]'),
  rule('.task-filter-chip-leading.status-doing', 'bg-[#2f81f7]'),
  rule('.task-filter-chip-leading.status-success', 'bg-[#238636]'),
  rule('.task-filter-chip-leading.category-task', 'bg-[#6f42c1]'),
  rule('.task-filter-chip-leading.category-bug', 'bg-[#da3633]'),
  rule('.task-filter-chip-leading.category-analysis', 'bg-[#0969da]'),
  rule('.task-filter-chip-title', 'min-w-[0] overflow-hidden text-[14px] font-medium leading-[1.3] text-ellipsis whitespace-nowrap'),
  rule('.task-filter-chip-remove', 'inline-flex size-[24px] flex-none items-center justify-center p-0 text-[#5f6368] bg-[#e8eaed] border-[1px_solid_transparent] rounded-full'),
  rule('.task-filter-chip-remove:hover:not(:disabled)', 'text-[#202124] bg-[#dadce0] border-color-[rgba(60,_64,_67,_0.12)]'),
  rule('.task-filter-chip-remove svg', 'size-[16px] fill-none pointer-events-none stroke-current stroke-round stroke-width-[2.25]'),

  rule('.task-item-list', 'grid gap-[10px]'),
  rule('.task-item-card', 'relative grid grid-cols-[minmax(0,_1fr)_auto] gap-[12px] items-start overflow-hidden p-[16px_12px_14px] bg-[var(--vscode-editor-background)] border-[1px_solid_var(--vscode-panel-border)] rounded-lg cursor-pointer'),
  rule('.task-item-card::before', 'absolute top-[0] left-[0] w-[var(--task-progress,_0%)] h-[3px] bg-[var(--task-progress-color,_var(--vscode-progressBar-background))] content-[""]'),
  rule('.task-item-card.has-warning', 'border-color-[var(--vscode-inputValidation-warningBorder)]'),
  rule('.task-item-card.has-error', 'border-color-[var(--vscode-inputValidation-errorBorder)]'),
  rule('.task-item-card:hover', 'bg-[var(--vscode-list-hoverBackground)]'),
  rule('.task-item-card:focus-visible', 'outline-[1px_solid_var(--vscode-focusBorder)] outline-offset-[2px]'),
  rule('.task-item-main', 'min-w-[0]'),
  rule('.task-item-title', 'flex items-center flex-wrap gap-[8px] mb-[6px] text-[var(--vscode-editor-foreground)] text-[14px] font-bold'),
  rule('.task-item-name, .task-item-paths, .document-name, .document-path', 'overflow-hidden text-ellipsis whitespace-nowrap'),
  rule('.task-item-name', 'min-w-[0]'),
  rule('.task-item-meta, .task-item-paths', 'text-[var(--vscode-descriptionForeground)] text-[12px] leading-[1.45]'),
  rule('.task-item-summary-row', 'flex flex-wrap gap-[6px] mt-[9px]'),
  rule('.task-summary-chip', 'inline-flex max-w-[100%] items-center overflow-hidden p-[3px_7px] text-[var(--vscode-foreground)] bg-[var(--vscode-badge-background)] border-[1px_solid_var(--vscode-panel-border)] rounded-full text-[11px] font-semibold leading-[1.3] text-ellipsis whitespace-nowrap'),
  rule('.task-item-progress', 'grid grid-cols-[minmax(0,_1fr)_auto] gap-[8px] items-center mt-[10px]'),
  rule('.task-item-progress-track', 'block h-[6px] overflow-hidden bg-[var(--vscode-input-background)] border-[1px_solid_var(--vscode-panel-border)] rounded-full'),
  rule('.task-item-progress-fill', 'block h-[100%] bg-[var(--task-progress-color,_var(--vscode-progressBar-background))] rounded-full'),
  rule('.task-item-progress-label', 'text-[var(--vscode-descriptionForeground)] text-[11px] font-bold'),
  rule('.task-item-issue', 'mt-[8px] text-[12px] font-semibold leading-[1.4]'),
  rule('.task-item-issue.warning', 'text-[var(--vscode-inputValidation-warningForeground)]'),
  rule('.task-item-issue.error', 'text-[var(--vscode-errorForeground)]'),
  rule('.task-item-paths', 'mt-[8px]'),
  rule('.task-item-actions', 'flex flex-wrap justify-end gap-[8px]'),

  rule('.icon-button', 'inline-flex size-[32px] items-center justify-center p-0 bg-transparent border-[1px_solid_transparent] rounded'),
  rule('.icon-button svg', 'size-[16px] fill-none pointer-events-none stroke-current stroke-round stroke-width-[2]'),
  rule('.icon-button svg *', 'pointer-events-none'),
  rule('.create-icon-button', 'size-[44px] text-[var(--vscode-button-foreground)] bg-[var(--vscode-button-background)] border-color-[var(--vscode-focusBorder)]'),
  rule('.create-icon-button:hover:not(:disabled)', 'bg-[var(--vscode-button-hoverBackground)] border-color-[var(--vscode-focusBorder)]'),
  rule('.create-icon-button svg', 'size-[20px]'),
  rule('.filter-icon-button', 'text-[var(--vscode-icon-foreground)] bg-[var(--vscode-button-secondaryBackground)] border-color-[var(--vscode-panel-border)]'),
  rule('.filter-icon-button:hover:not(:disabled), .filter-icon-button.active', 'text-[var(--vscode-button-foreground)] bg-[var(--vscode-button-background)] border-color-[var(--vscode-focusBorder)]'),
  rule('.icon-button.danger', 'text-[#ef4444]'),
  rule('.icon-button.danger:hover:not(:disabled)', 'text-[#f87171] bg-[rgba(239,_68,_68,_0.12)] border-color-[rgba(239,_68,_68,_0.42)]'),

  rule('.create-grid', 'grid grid-cols-[minmax(280px,_0.8fr)_minmax(300px,_1.2fr)] gap-[18px] items-start'),
  rule('.create-form', 'grid gap-[18px] min-w-[0]'),
  rule('.create-stepper', 'relative grid grid-cols-[repeat(3,_minmax(0,_1fr))] gap-[8px] overflow-hidden p-[18px] mb-[2px] border-[1px_solid_rgba(176,_184,_214,_0.16)] rounded-lg', '  background: linear-gradient(112deg, rgba(255, 255, 255, 0.05) 0 10%, transparent 10% 22%, rgba(255, 255, 255, 0.035) 22% 34%, transparent 34% 100%), #1d1a2d;\n'),
  rule('.create-stepper-step', 'grid grid-rows-[7px_auto] gap-[14px] min-w-[0] p-0 text-[var(--vscode-descriptionForeground)] bg-transparent border-none text-left cursor-pointer transition-[transform_140ms_ease]'),
  rule('.create-stepper-step *', 'cursor-pointer'),
  rule('.create-stepper-step:hover:not(:disabled)', 'bg-transparent translate-y-[-1px]'),
  rule('.create-stepper-step:focus-visible', 'outline-[1px_solid_var(--vscode-focusBorder)] outline-offset-[6px]'),
  rule('.create-stepper-track', 'block h-[7px] overflow-hidden bg-[#c8cedc] rounded-full shadow-[inset_0_0_0_1px_rgba(255,_255,_255,_0.16)]'),
  rule('.create-stepper-step.not-fill .create-stepper-track', 'bg-[#c8cedc] shadow-[inset_0_0_0_1px_rgba(255,_255,_255,_0.16)]'),
  rule('.create-stepper-step.on-select .create-stepper-track, .create-stepper-step.active .create-stepper-track', 'bg-[#6d4df4] shadow-[0_0_0_1px_rgba(109,_77,_244,_0.28),_0_0_18px_rgba(109,_77,_244,_0.32)]'),
  rule('.create-stepper-step.fill .create-stepper-track, .create-stepper-step.complete .create-stepper-track', 'bg-[#36d99a] shadow-[0_0_0_1px_rgba(54,_217,_154,_0.22),_0_0_18px_rgba(54,_217,_154,_0.28)]'),
  rule('.create-stepper-body', 'flex items-center gap-[10px] min-w-[0]'),
  rule('.create-stepper-marker', 'relative inline-flex size-[32px] flex-[0_0_32px] items-center justify-center text-[#101624] bg-transparent border-[3px_solid_#c8cedc] rounded-full text-[0] font-bold'),
  rule('.create-stepper-step.not-fill .create-stepper-marker', 'bg-transparent border-color-[#c8cedc]'),
  rule('.create-stepper-step.on-select .create-stepper-marker, .create-stepper-step.active .create-stepper-marker', 'bg-[#6d4df4] border-color-[#6d4df4] shadow-[0_0_0_4px_rgba(109,_77,_244,_0.15)]'),
  rule('.create-stepper-step.on-select .create-stepper-marker::after, .create-stepper-step.active .create-stepper-marker::after', 'size-[8px] bg-[#ffffff] rounded-full content-[""]'),
  rule('.create-stepper-step.fill .create-stepper-marker, .create-stepper-step.complete .create-stepper-marker', 'bg-[#22c55e] border-color-[#22c55e]'),
  rule('.create-stepper-step.fill .create-stepper-marker::before, .create-stepper-step.complete .create-stepper-marker::before', 'w-[11px] h-[6px] border-l-[2px_solid_#102116] border-b-[2px_solid_#102116] content-[""] transform-[rotate(-45deg)_translate(1px,_-1px)]'),
  rule('.create-stepper-copy', 'grid gap-[4px] min-w-[0]'),
  rule('.create-stepper-title', 'overflow-hidden text-[rgba(246,_247,_251,_0.92)] text-[14px] font-bold leading-[1.3] text-ellipsis whitespace-nowrap'),
  rule('.create-stepper-step.not-fill .create-stepper-title', 'text-[rgba(246,_247,_251,_0.82)]'),
  rule('.create-stepper-step.on-select .create-stepper-title, .create-stepper-step.active .create-stepper-title, .create-stepper-step.fill .create-stepper-title, .create-stepper-step.complete .create-stepper-title', 'text-[#ffffff]'),
  rule('.create-stepper-description', 'overflow-hidden text-[rgba(225,_229,_240,_0.62)] text-[12px] font-normal leading-[1.35] text-ellipsis whitespace-nowrap'),
  rule('.create-stepper-step.not-fill .create-stepper-description', 'text-[rgba(225,_229,_240,_0.54)]'),
  rule('.create-stepper-step.on-select .create-stepper-description, .create-stepper-step.active .create-stepper-description', 'text-[rgba(216,_207,_255,_0.9)]'),
  rule('.create-stepper-step.fill .create-stepper-description', 'text-[rgba(210,_255,_233,_0.78)]'),
  rule('.create-stepper-result', 'inline-block max-w-[100%] overflow-hidden pt-[1px] text-[rgba(246,_247,_251,_0.92)] text-[12px] font-bold leading-[1.3] text-ellipsis whitespace-nowrap'),
  raw('.create-stepper-result[hidden] {\n  display: none;\n}'),
  rule('.create-stepper-step.not-fill .create-stepper-result', 'text-[rgba(225,_229,_240,_0.58)]'),
  rule('.create-stepper-step.on-select .create-stepper-result', 'text-[#d8cfff]'),
  rule('.create-stepper-step.fill .create-stepper-result', 'text-[#9ff0c7]'),
  rule('.create-step-panel', 'min-h-[250px]'),
  rule('.create-status', 'min-h-[20px] mb-[12px] text-[var(--vscode-descriptionForeground)] text-[13px] leading-[1.5]'),
  rule('.create-status.error', 'text-[var(--vscode-errorForeground)]'),
  rule('.create-actions', 'flex justify-end gap-[8px]'),

  rule('.workflow-layout-preview', 'min-h-[360px] overflow-hidden p-0 bg-[var(--vscode-editor-background)] border-[1px_solid_rgba(150,_150,_170,_0.2)] rounded-lg', '  background-image: radial-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px);\n  background-size: 16px 16px;\n'),
  rule('.workflow-layout-canvas', 'flex flex-col min-h-[360px]'),
  rule('.workflow-layout-header', 'flex items-center justify-between gap-[12px] p-[14px_18px] bg-[var(--vscode-sideBar-background)] border-b-[1px_solid_var(--vscode-panel-border)]'),
  rule('.workflow-layout-title', 'max-w-[55%] overflow-hidden text-[var(--vscode-foreground)] text-[16px] font-semibold leading-[1.3] text-ellipsis whitespace-nowrap'),
  rule('.workflow-layout-file', 'max-w-[45%] overflow-hidden text-[var(--vscode-descriptionForeground)] font-editor text-[12px] leading-[1.4] text-right text-ellipsis whitespace-nowrap'),
  rule('.workflow-layout-body', 'flex min-h-[300px] justify-center overflow-auto p-[32px_24px]'),
  rule('.workflow-layout-preview .tree', 'flex flex-col items-center gap-[0] min-h-[200px]'),
  rule('.workflow-layout-preview .tree-empty', 'm-[auto] text-[var(--vscode-descriptionForeground)] text-[13px]'),
  rule('.workflow-layout-preview .tree-empty.compact', 'min-w-[120px] p-[24px_10px] text-center'),
  rule('.workflow-layout-empty', 'flex min-h-[360px] items-center justify-center p-[24px] text-[var(--vscode-descriptionForeground)] text-[13px] text-center'),
  rule('.workflow-layout-preview .block-wrap', 'relative flex w-[140px] flex-shrink-0 flex-col items-center'),
  rule('.workflow-layout-preview .block-card', 'relative flex size-[110px] items-center justify-center bg-[rgba(45,_45,_48,_0.95)] border-[1px_solid_rgba(255,_255,_255,_0.12)] rounded-xl transition-[border-color_0.15s,_transform_0.1s]'),
  rule('.workflow-layout-preview .block-card:hover', 'border-color-[var(--vscode-focusBorder)] translate-y-[-1px]'),
  rule('.workflow-layout-preview .block-card.status-running', 'border-color-[var(--vscode-progressBar-background)]'),
  rule('.workflow-layout-preview .block-card.status-success', 'border-color-[#4caf50]'),
  rule('.workflow-layout-preview .block-card.status-failed', 'border-color-[var(--vscode-errorForeground)]'),
  rule('.workflow-layout-preview .block-icon', 'flex items-center justify-center text-[42px] leading-none'),
  rule('.workflow-layout-preview .block-label', 'max-w-[140px] overflow-hidden mt-[14px] text-[var(--vscode-foreground)] text-[13px] font-medium text-center text-ellipsis whitespace-nowrap'),
  rule('.workflow-layout-preview .block-sublabel', 'max-w-[140px] overflow-hidden mt-[4px] text-[var(--vscode-descriptionForeground)] text-[11px] text-center text-ellipsis whitespace-nowrap'),
  rule('.workflow-layout-preview .parallel-group', 'relative flex min-w-[200px] flex-col items-stretch p-[14px_16px] bg-[rgba(45,_45,_48,_0.4)] border-[1px_dashed_rgba(255,_255,_255,_0.25)] rounded-xl'),
  rule('.workflow-layout-preview .parallel-group:hover', 'border-color-[var(--vscode-focusBorder)]'),
  rule('.workflow-layout-preview .parallel-group.status-running', 'border-color-[var(--vscode-progressBar-background)]'),
  rule('.workflow-layout-preview .parallel-group.status-success', 'border-color-[#4caf50]'),
  rule('.workflow-layout-preview .parallel-group.status-failed', 'border-color-[var(--vscode-errorForeground)]'),
  rule('.workflow-layout-preview .parallel-header', 'mb-[10px] text-[var(--vscode-descriptionForeground)] text-[10px] tracking-[0.5px] text-center uppercase'),
  rule('.workflow-layout-preview .parallel-children', 'flex flex-wrap items-start justify-center gap-[28px]'),
  rule('.workflow-layout-connector', 'w-[0] h-[32px] flex-shrink-0 border-l-[1px_dashed_rgba(255,_255,_255,_0.35)]'),
  rule('.workflow-mock', 'min-h-[300px] p-[16px] bg-[#070711] border-[1px_solid_rgba(150,_150,_170,_0.2)] rounded-lg'),
  rule('.workflow-mock svg', 'block w-[100%] h-[auto] text-[#f4f4f7]'),
  rule('.workflow-line', 'fill-none stroke-[rgba(218,_214,_232,_0.78)] stroke-width-[2.5] stroke-round'),
  rule('.workflow-line.dashed', 'stroke-dasharray-[6_8] stroke-[rgba(218,_214,_232,_0.52)]'),
  rule('.workflow-node', 'fill-[rgba(62,_65,_70,_0.96)] stroke-[rgba(205,_207,_218,_0.68)] stroke-width-[2]'),
  rule('.workflow-node.circle', 'fill-[rgba(45,_48,_60,_0.98)]'),
  rule('.workflow-mock text', 'fill-[#ffffff] font-vscode text-[13px] font-bold', '  text-anchor: middle;\n  dominant-baseline: middle;\n'),

  rule('.task-manager-grid', 'grid grid-cols-[minmax(420px,_1.05fr)_minmax(360px,_0.95fr)] gap-[16px] items-start'),
  rule('.task-block', 'min-h-[460px] bg-[var(--vscode-editor-background)] border-[1px_solid_var(--vscode-panel-border)] rounded-lg p-[18px]'),
  rule('.block-header', 'flex items-start justify-between gap-[12px] pb-[14px] mb-[12px] border-b-[1px_solid_var(--vscode-panel-border)]'),
  rule('.task-tree', 'min-h-[500px] overflow-auto border-[1px_solid_rgba(150,_150,_170,_0.2)] rounded-lg bg-[#070711]', '  background-image: radial-gradient(circle, rgba(170, 176, 210, 0.22) 1px, transparent 1px);\n  background-position: 0 0;\n  background-size: 20px 20px;\n'),
  rule('.flow-canvas', 'relative w-[700px] h-[500px] text-[#f4f4f7]'),
  rule('.flow-connectors', 'absolute inset-[0] w-[700px] h-[500px] pointer-events-none'),
  rule('.flow-line', 'fill-none stroke-[rgba(218,_214,_232,_0.82)] stroke-width-[2.5] stroke-round'),
  rule('.flow-line.dashed', 'stroke-[rgba(218,_214,_232,_0.62)] stroke-dasharray-[6_8] transition-[stroke_180ms_ease,_stroke-width_180ms_ease,_opacity_180ms_ease]'),
  rule('.flow-line.source-line.ready, .flow-line.code-line.running', 'stroke-[#22c55e] stroke-width-[3] opacity-[0.95]', '  animation: flow-dash-ready 1.1s linear infinite;\n'),
  rule('.flow-arrow', 'fill-[rgba(218,_214,_232,_0.92)] transition-[fill_180ms_ease]'),
  rule('.flow-arrow.running', 'fill-[#22c55e]'),
  raw('@keyframes flow-dash-ready {\n  from {\n    stroke-dashoffset: 28;\n  }\n\n  to {\n    stroke-dashoffset: 0;\n  }\n}'),
  rule('.flow-node', 'absolute left-[var(--x)] top-[var(--y)] w-[var(--w)] h-[var(--h)] flex items-center gap-[14px] p-[14px] bg-[rgba(62,_65,_70,_0.96)] text-[#f7f7fb] border-[2px_solid_rgba(205,_207,_218,_0.68)] rounded-lg shadow-[0_12px_32px_rgba(0,_0,_0,_0.28)] text-left'),
  rule('.flow-node:hover, .flow-node.selected', 'border-color-[#d5d6ff] shadow-[0_0_0_2px_rgba(127,_139,_255,_0.2),_0_14px_34px_rgba(0,_0,_0,_0.34)]'),
  rule('.flow-node.selected', 'bg-[rgba(78,_82,_92,_0.98)]'),
  rule('.flow-node.running', 'border-color-[rgba(34,_197,_94,_0.88)] shadow-[0_0_0_2px_rgba(34,_197,_94,_0.2),_0_14px_34px_rgba(0,_0,_0,_0.34)]'),
  rule('.flow-node.square', 'flex-col justify-center gap-[8px] text-center p-[12px]'),
  rule('.flow-node.circle', 'flex-col justify-center w-[var(--w)] h-[var(--h)] rounded-full p-[10px] bg-[rgba(45,_48,_60,_0.98)] text-center'),
  rule('.flow-icon', 'flex-[0_0_auto] size-[40px] inline-flex items-center justify-center text-[#f7f7fb]'),
  rule('.flow-icon svg', 'block size-[100%]'),
  rule('.flow-node.square .flow-icon, .flow-node.circle .flow-icon', 'size-[42px]'),
  rule('.flow-title', 'block max-w-[100%] overflow-hidden text-[#ffffff] text-[14px] font-bold leading-[1.25] text-ellipsis whitespace-nowrap'),
  rule('.flow-node.wide .flow-title', 'text-[15px]'),
  rule('.flow-node .flow-icon + span', 'min-w-[0]'),
  rule('.flow-meta', 'block max-w-[100%] overflow-hidden mt-[3px] text-[rgba(235,_235,_245,_0.62)] text-[11px] leading-[1.25] text-ellipsis whitespace-nowrap'),
  rule('.flow-node.circle .flow-meta', 'whitespace-normal'),
  rule('.flow-label', 'absolute left-[var(--x)] top-[var(--y)] w-[var(--w)] text-[rgba(235,_235,_245,_0.76)] text-[11px] font-semibold text-center pointer-events-none', '  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);\n'),
  rule('.flow-label.label-above', 'translate-y-[-22px]'),
  rule('.flow-status', 'absolute right-[10px] bottom-[9px]'),
  rule('.flow-node.circle .flow-status, .flow-node.square .flow-status', 'static mt-[2px]'),
  rule('.flow-port', 'absolute size-[14px] bg-[#cbd0dc] border-[1px_solid_rgba(255,_255,_255,_0.58)] rotate-[45deg] shadow-[0_2px_8px_rgba(0,_0,_0,_0.35)]'),
  rule('.flow-port.round', 'size-[18px] rounded-full transform-[none]'),
  rule('.flow-port.left', 'left-[-8px] top-[calc(50%_-_7px)]'),
  rule('.flow-port.right', 'right-[-9px] top-[calc(50%_-_9px)]'),
  rule('.flow-port.bottom-a', 'left-[48px] bottom-[-8px]'),
  rule('.flow-port.bottom-b', 'left-[104px] bottom-[-8px]'),
  rule('.flow-port.bottom-c', 'right-[48px] bottom-[-8px]'),
  rule('.status-badge', 'inline-flex items-center justify-center min-w-[60px] p-[3px_7px] rounded-[12px] text-[10px] font-semibold border-[1px_solid_var(--vscode-badge-background)] bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]'),
  rule('.status-ready, .status-sync, .status-running', 'bg-[var(--vscode-inputValidation-infoBackground)] text-[var(--vscode-inputValidation-infoForeground)] border-color-[var(--vscode-inputValidation-infoBorder)]'),
  rule('.status-missing, .status-un-sync', 'bg-[var(--vscode-inputValidation-warningBackground)] text-[var(--vscode-inputValidation-warningForeground)] border-color-[var(--vscode-inputValidation-warningBorder)]'),
  rule('.status-unknown', 'bg-[var(--vscode-textBlockQuote-background)] text-[var(--vscode-descriptionForeground)] border-color-[var(--vscode-panel-border)]'),
  rule('.status-failed', 'bg-[var(--vscode-inputValidation-errorBackground)] text-[var(--vscode-inputValidation-errorForeground)] border-color-[var(--vscode-inputValidation-errorBorder)]'),
  rule('.status-skipped', 'bg-[var(--vscode-textBlockQuote-background)] text-[var(--vscode-descriptionForeground)] border-color-[var(--vscode-panel-border)]'),
  rule('.status-completed', 'bg-[rgba(34,_197,_94,_0.16)] text-[#4ade80] border-color-[rgba(34,_197,_94,_0.58)]'),

  raw(`
.task-tree {
  position: relative;
}

.task-detail-view {
  display: block;
}

.task-detail-view[hidden] {
  display: none;
}

.task-detail-view .task-tree-block {
  min-height: calc(100vh - 118px);
}

.task-tree-zoom-controls {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  gap: 2px;
  padding: 2px;
  background: var(--vscode-editorWidget-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 6px;
}

.task-tree-zoom-controls button {
  min-width: 28px;
  height: 26px;
  padding: 0 8px;
  background: transparent;
  color: var(--vscode-foreground);
  border: 1px solid transparent;
  border-radius: 4px;
  font-size: 12px;
}

.task-tree-zoom-controls button:hover:not(:disabled) {
  background: var(--vscode-toolbar-hoverBackground);
  border-color: var(--vscode-panel-border);
}

.task-tree-zoom-level {
  min-width: 44px;
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
  text-align: center;
  user-select: none;
}

.workflow-detail-canvas {
  min-width: 720px;
  min-height: 620px;
  color: #f4f4f7;
}

.workflow-detail-actionbar {
  position: sticky;
  right: 0;
  bottom: 0;
  z-index: 6;
  display: flex;
  justify-content: flex-end;
  margin-top: -72px;
  padding: 0 18px 18px;
  pointer-events: none;
}

.workflow-detail-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 7px;
  background: rgba(7, 7, 17, 0.88);
  border: 1px solid rgba(150, 150, 170, 0.22);
  border-radius: 8px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.32);
  pointer-events: auto;
}

.workflow-run-message {
  max-width: 260px;
  overflow: hidden;
  color: rgba(235, 235, 245, 0.7);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflow-run-button {
  min-width: 112px;
  padding: 9px 16px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 6px;
  background: rgba(64, 68, 78, 0.96);
  color: #ffffff;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0;
}

.workflow-run-button:hover:not(:disabled) {
  background: rgba(82, 88, 102, 0.98);
}

.workflow-run-button.running {
  color: #f87171;
  border-color: rgba(248, 113, 113, 0.5);
}

.workflow-run-button.finished {
  color: #4ade80;
  border-color: rgba(74, 222, 128, 0.52);
}

.workflow-detail-titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid rgba(150, 150, 170, 0.2);
  background: rgba(7, 7, 17, 0.92);
}

.workflow-detail-heading,
.workflow-detail-file,
.workflow-detail-sublabel {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflow-detail-heading {
  min-width: 0;
  color: #ffffff;
  font-size: 15px;
  font-weight: 700;
}

.workflow-detail-file {
  max-width: 240px;
  color: rgba(235, 235, 245, 0.62);
  font-size: 12px;
  font-family: var(--vscode-editor-font-family);
}

.workflow-detail-body {
  min-height: 560px;
  padding: 40px 28px 56px;
  display: flex;
  justify-content: center;
}

.workflow-detail-zoom-surface {
  transform-origin: top center;
}

.workflow-detail-tree {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: max-content;
}

.workflow-detail-empty {
  margin: 80px auto;
  color: rgba(235, 235, 245, 0.62);
  font-size: 13px;
}

.workflow-detail-empty.compact {
  margin: 18px;
}

.workflow-detail-connector {
  width: 0;
  height: 38px;
  border-left: 1px dashed rgba(218, 214, 232, 0.52);
}

.workflow-detail-block-wrap {
  position: relative;
  display: flex;
  width: 190px;
  flex-shrink: 0;
  flex-direction: column;
  align-items: center;
  color: #f4f4f7;
}

.workflow-detail-block-wrap.step-wrap {
  padding: 0;
  background: transparent;
  border: none;
  font: inherit;
  cursor: pointer;
}

.workflow-detail-block-wrap.step-wrap:hover:not(:disabled) {
  background: transparent;
}

.workflow-detail-block-wrap.step-wrap:disabled {
  opacity: 1;
  cursor: default;
}

.workflow-detail-card {
  position: relative;
  display: flex;
  width: 112px;
  height: 112px;
  align-items: center;
  justify-content: center;
  background: rgba(45, 45, 48, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.28);
  transition: border-color 0.15s, transform 0.1s, box-shadow 0.15s;
}

.workflow-detail-block-wrap.step-wrap:hover .workflow-detail-card,
.workflow-detail-block-wrap.selected .workflow-detail-card,
.workflow-detail-block-wrap.selected .workflow-detail-parallel {
  border-color: #d5d6ff;
  outline: 2px solid rgba(127, 139, 255, 0.35);
  outline-offset: 2px;
  box-shadow: 0 0 0 2px rgba(127, 139, 255, 0.16), 0 14px 34px rgba(0, 0, 0, 0.34);
  transform: translateY(-1px);
}

.workflow-detail-card.status-ready,
.workflow-detail-card.status-sync,
.workflow-detail-card.status-completed {
  border-color: rgba(34, 197, 94, 0.72);
}

.workflow-detail-card.status-running {
  border-color: rgba(245, 158, 11, 0.42);
  box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.16), 0 14px 34px rgba(0, 0, 0, 0.34);
}

.workflow-detail-card.status-missing,
.workflow-detail-card.status-un-sync {
  border-color: rgba(245, 158, 11, 0.7);
}

.workflow-detail-card.status-failed {
  border-color: var(--vscode-inputValidation-errorBorder);
}

.workflow-detail-running-border {
  position: absolute;
  inset: 0;
  z-index: 2;
  overflow: hidden;
  border-radius: 8px;
  opacity: 0;
  pointer-events: none;
}

.workflow-detail-running-border svg {
  display: block;
  width: 100%;
  height: 100%;
}

.workflow-detail-running-border rect {
  fill: none;
  stroke: #fbbf24;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 24 76;
  stroke-dashoffset: 0;
  filter: drop-shadow(0 0 4px rgba(251, 191, 36, 0.78));
  vector-effect: non-scaling-stroke;
  will-change: stroke-dashoffset;
  animation: workflow-border-track 1.9s linear infinite;
}

.workflow-detail-card.status-running .workflow-detail-running-border {
  opacity: 1;
}

.workflow-detail-completed-icon {
  position: absolute;
  top: -9px;
  right: -9px;
  z-index: 3;
  display: inline-flex;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  background: #22c55e;
  border: 2px solid rgba(7, 7, 17, 0.94);
  border-radius: 999px;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.28);
}

.workflow-detail-completed-icon svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.6;
}

@keyframes workflow-border-track {
  to {
    stroke-dashoffset: -100;
  }
}

.workflow-detail-icon {
  display: inline-flex;
  width: 46px;
  height: 46px;
  align-items: center;
  justify-content: center;
  color: #f7f7fb;
}

.workflow-detail-icon svg {
  display: block;
  width: 100%;
  height: 100%;
}

.workflow-detail-status {
  position: absolute;
  right: 8px;
  bottom: 8px;
}

.workflow-detail-label {
  display: -webkit-box;
  max-width: 190px;
  min-height: 34px;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  margin-top: 13px;
  color: #ffffff;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.3;
  text-align: center;
  word-break: break-word;
}

.workflow-detail-sublabel {
  max-width: 190px;
  margin-top: 4px;
  color: rgba(235, 235, 245, 0.62);
  font-size: 11px;
  line-height: 1.3;
  text-align: center;
}

.workflow-error-tooltip {
  position: absolute;
  left: calc(50% + 66px);
  top: 18px;
  z-index: 4;
  display: flex;
  width: 230px;
  min-height: 44px;
  align-items: flex-start;
  gap: 8px;
  padding: 9px 10px;
  color: var(--vscode-inputValidation-errorForeground);
  background: var(--vscode-inputValidation-errorBackground);
  border: 1px solid var(--vscode-inputValidation-errorBorder);
  border-radius: 8px;
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.36);
  pointer-events: auto;
}

.workflow-error-tooltip::before {
  position: absolute;
  left: -6px;
  top: 15px;
  width: 10px;
  height: 10px;
  content: '';
  background: var(--vscode-inputValidation-errorBackground);
  border-left: 1px solid var(--vscode-inputValidation-errorBorder);
  border-bottom: 1px solid var(--vscode-inputValidation-errorBorder);
  transform: rotate(45deg);
}

.workflow-error-tooltip-text {
  display: -webkit-box;
  min-width: 0;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  font-size: 12px;
  line-height: 1.35;
  text-align: left;
  word-break: break-word;
}

.workflow-error-tooltip-close {
  display: inline-flex;
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  color: inherit;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
}

.workflow-error-tooltip-close:hover {
  background: rgba(255, 255, 255, 0.12);
}

.workflow-detail-block-wrap.parallel-wrap {
  width: auto;
}

.workflow-detail-parallel {
  position: relative;
  min-width: 240px;
  padding: 14px 16px 16px;
  background: rgba(45, 45, 48, 0.4);
  border: 1px dashed rgba(255, 255, 255, 0.25);
  border-radius: 8px;
  transition: border-color 0.15s, transform 0.1s, box-shadow 0.15s;
}

.workflow-detail-parallel:hover {
  border-color: #d5d6ff;
}

.workflow-detail-parallel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  color: rgba(235, 235, 245, 0.62);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
}

.workflow-detail-parallel-children {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: center;
  gap: 28px;
}

.workflow-detail-parallel.status-ready,
.workflow-detail-parallel.status-sync,
.workflow-detail-parallel.status-completed {
  border-color: rgba(34, 197, 94, 0.72);
}

.workflow-detail-parallel.status-failed {
  border-color: var(--vscode-inputValidation-errorBorder);
}

.task-detail-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.54);
}

.task-detail-modal {
  display: flex;
  width: min(860px, 96vw);
  max-height: min(760px, 92vh);
  flex-direction: column;
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 8px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.48);
}

.task-detail-modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px;
  border-bottom: 1px solid var(--vscode-panel-border);
}

.task-detail-modal-header h2 {
  margin-bottom: 6px;
}

.task-detail-modal-close {
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  padding: 0;
  background: transparent;
  color: var(--vscode-icon-foreground);
  border: 1px solid transparent;
  border-radius: 4px;
  font-size: 18px;
  line-height: 1;
}

.task-detail-modal-close:hover:not(:disabled) {
  background: var(--vscode-toolbar-hoverBackground);
  border-color: var(--vscode-panel-border);
}

.task-detail-modal-body {
  min-height: 0;
  overflow-y: auto;
  padding: 18px;
}

.workflow-step-config {
  margin-top: 14px;
}
`),

  rule('.detail-header', 'mb-[16px]'),
  rule('.detail-header h2', 'mb-[6px]'),
  rule('.detail-action-row', 'flex flex-wrap gap-[8px] items-center'),
  rule('.code-run-panel', 'grid gap-[12px] p-[14px] bg-[var(--vscode-input-background)] border-[1px_solid_var(--vscode-panel-border)] rounded-lg'),
  rule('.code-run-panel.running', 'border-color-[rgba(34,_197,_94,_0.72)] shadow-[inset_3px_0_0_#22c55e]'),
  rule('.code-run-panel.error', 'border-color-[var(--vscode-inputValidation-errorBorder)] shadow-[inset_3px_0_0_var(--vscode-inputValidation-errorBorder)]'),
  rule('.code-run-label', 'block mb-[6px] text-[var(--vscode-descriptionForeground)] text-[11px] font-bold uppercase'),
  rule('.code-run-panel code', 'text-[var(--vscode-editor-foreground)] font-editor text-[12px] break-words'),
  rule('.code-run-status', 'text-[var(--vscode-descriptionForeground)] text-[13px] leading-[1.5]'),
  rule('.code-run-panel.error .code-run-status', 'text-[var(--vscode-errorForeground)]'),

  rule('.filter-dialog-backdrop, .markdown-dialog-backdrop, .delete-dialog-backdrop', 'fixed inset-[0] z-[20] flex items-center justify-center p-[24px] bg-[rgba(0,_0,_0,_0.54)]'),
  rule('.filter-dialog', 'flex w-[min(480px,_92vw)] max-h-[min(640px,_92vh)] flex-col bg-[var(--vscode-editor-background)] border-[1px_solid_var(--vscode-panel-border)] rounded-lg shadow-[0_24px_80px_rgba(0,_0,_0,_0.48)]'),
  rule('.filter-dialog-header, .markdown-dialog-header, .delete-dialog-header', 'flex items-start justify-between gap-[16px] border-b-[1px_solid_var(--vscode-panel-border)]'),
  rule('.filter-dialog-header', 'p-[16px]'),
  rule('.filter-dialog-body', 'grid gap-[10px] overflow-y-auto p-[16px]'),
  rule('.filter-field', 'grid gap-[6px]'),
  rule('.filter-field span, .filter-section legend', 'text-[var(--vscode-editor-foreground)] text-[13px] font-bold'),
  rule('.filter-field input, .form-field input, .form-field select', 'w-[100%] p-[10px_11px] text-[var(--vscode-input-foreground)] bg-[var(--vscode-input-background)] border-[1px_solid_var(--vscode-input-border)] rounded font-inherit text-[13px] outline-none'),
  rule('.filter-field input:focus, .form-field input:focus, .form-field select:focus', 'border-color-[var(--vscode-focusBorder)] shadow-[0_0_0_1px_var(--vscode-focusBorder)]'),
  rule('.filter-section', 'grid gap-[8px] min-w-[0] p-[10px] m-0 border-[1px_solid_var(--vscode-panel-border)] rounded-lg'),
  rule('.filter-section legend', 'p-[0_4px]'),
  rule('.filter-option', 'flex items-center gap-[10px] p-[10px] bg-[var(--vscode-input-background)] border-[1px_solid_var(--vscode-panel-border)] rounded-md cursor-pointer'),
  rule('.filter-option input', 'size-[16px] m-0 accent-[var(--vscode-checkbox-selectBackground)]'),
  rule('.filter-option span', 'text-[var(--vscode-editor-foreground)] text-[13px] font-semibold'),
  rule('.filter-dialog-status', 'min-h-[20px] text-[var(--vscode-descriptionForeground)] text-[13px] leading-[1.5]'),
  rule('.filter-dialog-status.error', 'text-[var(--vscode-errorForeground)]'),
  rule('.filter-dialog-actions', 'flex justify-end gap-[8px] p-[0_16px_16px]'),
  rule('.delete-dialog', 'flex w-[min(420px,_92vw)] max-h-[min(320px,_92vh)] flex-col bg-[var(--vscode-editor-background)] border-[1px_solid_var(--vscode-panel-border)] rounded-lg shadow-[0_24px_80px_rgba(0,_0,_0,_0.48)]'),
  rule('.delete-dialog-header', 'p-[16px]'),
  rule('.delete-dialog-body', 'grid gap-[8px] p-[16px] text-[var(--vscode-foreground)] text-[13px] leading-[1.5]'),
  rule('.delete-dialog-body p', 'm-0'),
  rule('.delete-dialog-copy', 'text-[var(--vscode-descriptionForeground)]'),
  rule('.delete-dialog-actions', 'flex justify-end gap-[8px] p-[0_16px_16px]'),
  rule('.delete-dialog-actions button.danger', 'bg-[#dc2626] text-[#ffffff] border-[1px_solid_#dc2626] shadow-[0_8px_18px_rgba(220,_38,_38,_0.22)]'),
  rule('.delete-dialog-actions button.danger:hover:not(:disabled)', 'bg-[#b91c1c] border-color-[#b91c1c]'),

  rule('.markdown-dialog', 'flex w-[min(920px,_96vw)] max-h-[min(760px,_92vh)] flex-col bg-[var(--vscode-editor-background)] border-[1px_solid_var(--vscode-panel-border)] rounded-lg shadow-[0_24px_80px_rgba(0,_0,_0,_0.48)]'),
  rule('.markdown-dialog-header', 'p-[18px]'),
  rule('.markdown-dialog-close', 'size-[32px] flex-[0_0_auto] p-0 bg-transparent text-[var(--vscode-icon-foreground)] border-[1px_solid_transparent] rounded text-[20px] leading-none'),
  rule('.markdown-dialog-close:hover', 'bg-[var(--vscode-toolbar-hoverBackground)] border-color-[var(--vscode-panel-border)]'),
  rule('.markdown-dialog-toolbar', 'flex items-center justify-between gap-[12px] p-[14px_18px_8px]'),
  rule('.markdown-regenerate-button', 'p-[8px_12px]'),
  rule('.markdown-dialog-status', 'min-h-[20px] p-[0_18px] text-[var(--vscode-descriptionForeground)] text-[13px] leading-[1.5]'),
  rule('.markdown-dialog-status.error', 'text-[var(--vscode-errorForeground)]'),
  rule('.markdown-dialog-body', 'min-h-[360px] overflow-hidden p-[12px_18px_18px]'),
  rule('.markdown-review, .markdown-editor', 'w-[100%] min-h-[420px] max-h-[52vh] overflow-auto p-[12px] text-[var(--vscode-editor-foreground)] bg-[var(--vscode-textCodeBlock-background)] border-[1px_solid_var(--vscode-panel-border)] rounded-md font-editor text-[12px] leading-[1.5] whitespace-pre-wrap'),
  rule('.markdown-editor', 'resize-y outline-none'),
  rule('.markdown-editor:focus', 'border-color-[var(--vscode-focusBorder)] shadow-[0_0_0_1px_var(--vscode-focusBorder)]'),
  rule('.markdown-dialog-actions', 'flex justify-end gap-[10px] p-[0_18px_18px]'),

  rule('.jira-flow-section', 'p-[14px_0] border-t-[1px_solid_var(--vscode-panel-border)]'),
  rule('.jira-flow-section:last-child', 'border-b-[1px_solid_var(--vscode-panel-border)]'),
  rule('.jira-flow-heading, .jira-ticket-heading, .figma-node-heading', 'flex items-center justify-between gap-[12px] mb-[10px]'),
  rule('.jira-flow-heading h3, .jira-ticket-heading h3, .figma-node-heading h3', 'text-[var(--vscode-editor-foreground)] text-[13px] leading-[1.3]'),
  rule('.jira-flow-list', 'grid gap-[8px] list-none'),
  rule('.jira-flow-list li', 'grid grid-cols-[26px_minmax(0,_1fr)] gap-[10px] items-center min-h-[34px] text-[var(--vscode-foreground)] text-[13px] leading-[1.4]'),
  rule('.jira-step-index', 'inline-flex items-center justify-center size-[24px] text-[var(--vscode-badge-foreground)] bg-[var(--vscode-badge-background)] rounded-full text-[11px] font-bold'),
  rule('.jira-actions', 'flex flex-wrap gap-[8px] mb-[12px]'),
  rule('.jira-sync-status', 'min-h-[20px] mb-[12px] text-[var(--vscode-descriptionForeground)] text-[13px] leading-[1.5]'),
  rule('.jira-sync-status.error', 'text-[var(--vscode-errorForeground)]'),
  rule('.jira-ticket-section', 'mt-[14px] pt-[14px] border-t-[1px_solid_var(--vscode-panel-border)]'),
  rule('.jira-ticket-heading span, .figma-node-heading span', 'text-[var(--vscode-descriptionForeground)] text-[12px] text-right'),
  rule('.jira-ticket-summary', 'mb-[10px]'),
  rule('.jira-ticket-field', 'mb-[12px]'),
  rule('.jira-ticket-field:last-child', 'mb-[0]'),
  rule('.jira-ticket-field-title', 'mb-[6px] text-[var(--vscode-descriptionForeground)] text-[11px] font-semibold leading-[1.3] uppercase'),
  rule('.jira-ticket-title', 'text-[var(--vscode-editor-foreground)] text-[13px] font-semibold leading-[1.4] break-words'),
  rule('.jira-comment + .jira-comment', 'mt-[10px]'),
  rule('.jira-ticket-content', 'max-h-[360px] overflow-auto p-[10px] text-[var(--vscode-editor-foreground)] bg-[var(--vscode-textCodeBlock-background)] border-[1px_solid_var(--vscode-panel-border)] rounded-md font-editor text-[12px] leading-[1.5] whitespace-pre-wrap'),

  rule('.form-field', 'block mb-[14px]'),
  rule('.form-field span', 'block mb-[6px] text-[var(--vscode-editor-foreground)] text-[13px] font-semibold'),
  rule('.form-field select', 'min-h-[38px]'),
  rule('.form-field input.attention', 'border-color-[var(--vscode-inputValidation-warningBorder)] shadow-[0_0_0_2px_rgba(245,_158,_11,_0.28)]'),
  rule('.figma-bridge-toolbar', 'flex items-center justify-between gap-[12px] flex-wrap p-[12px] mb-[12px] bg-[var(--vscode-input-background)] border-[1px_solid_var(--vscode-panel-border)] rounded-md'),
  rule('.figma-bridge-status', 'flex items-center gap-[10px] min-w-[0]'),
  rule('.figma-status-dot', 'inline-block size-[10px] flex-shrink-0 rounded-full bg-[var(--vscode-errorForeground)]'),
  rule('.figma-status-dot.running', 'bg-[var(--vscode-editorWarning-foreground)]'),
  rule('.figma-status-dot.connected', 'bg-[var(--vscode-testing-iconPassed)]'),
  rule('.figma-bridge-status-main', 'min-w-[0]'),
  rule('.figma-bridge-status-title', 'text-[var(--vscode-editor-foreground)] text-[13px] font-semibold'),
  rule('.figma-actions', 'flex justify-start gap-[8px] flex-wrap mb-[12px]'),
  rule('.figma-bridge-toolbar .figma-actions', 'mb-[0]'),
  rule('.figma-sync-status', 'min-h-[20px] text-[var(--vscode-descriptionForeground)] text-[13px] leading-[1.5]'),
  rule('.figma-sync-status.error', 'text-[var(--vscode-errorForeground)]'),
  rule('.figma-connection-summary', 'mt-[14px] pt-[14px] border-t-[1px_solid_var(--vscode-panel-border)]'),
  rule('.figma-connection-title', 'mb-[5px] text-[var(--vscode-editor-foreground)] text-[13px] font-semibold'),
  rule('.figma-node-section', 'mt-[18px] pt-[14px] border-t-[1px_solid_var(--vscode-panel-border)]'),
  rule('.figma-context-meta', 'flex flex-wrap gap-[6px] mb-[10px]'),
  rule('.figma-context-meta span', 'max-w-[100%] overflow-hidden text-ellipsis whitespace-nowrap px-[7px] py-[3px] text-[11px] text-[var(--vscode-descriptionForeground)] bg-[var(--vscode-badge-background)] rounded'),
  rule('.figma-node-list', 'max-h-[360px] overflow-auto border-[1px_solid_var(--vscode-panel-border)] rounded-md'),
  rule('.figma-node-item', 'grid grid-cols-[auto_minmax(0,_1fr)_auto_auto] gap-[12px] items-center border-b-[1px_solid_var(--vscode-panel-border)]', '  padding: 9px 10px 9px calc(10px + (var(--depth) * 12px));\n'),
  rule('.figma-bridge-item', 'grid-cols-[minmax(0,_1fr)_auto] p-[9px_10px]'),
  rule('.figma-node-item:last-child', 'border-b-[none]'),
  rule('.figma-node-item.selected', 'bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]'),
  rule('.figma-node-main', 'min-w-[0]'),
  rule('.figma-node-checkbox', 'size-[16px] m-0 accent-[var(--vscode-checkbox-selectBackground)] cursor-pointer'),
  rule('.figma-node-name', 'overflow-hidden text-[var(--vscode-editor-foreground)] text-[13px] font-medium text-ellipsis whitespace-nowrap'),
  rule('.figma-node-item.selected .figma-node-name', 'text-[inherit]'),
  rule('.figma-node-path', 'overflow-hidden text-[var(--vscode-descriptionForeground)] text-[11px] leading-[1.5] text-ellipsis whitespace-nowrap'),
  rule('.figma-node-item.selected .figma-node-path', 'text-[inherit] opacity-[0.78]'),
  rule('.figma-node-meta', 'flex flex-col items-end gap-[3px] min-w-[92px]'),
  rule('.figma-node-meta span', 'text-[var(--vscode-descriptionForeground)] text-[10px] font-semibold'),
  rule('.figma-node-meta code', 'text-[var(--vscode-textPreformat-foreground)] font-editor text-[10px]'),
  rule('.figma-node-item.selected .figma-node-meta span, .figma-node-item.selected .figma-node-meta code', 'text-[inherit]'),
  rule('.figma-node-copy-button', 'inline-flex size-[28px] items-center justify-center p-0 text-[var(--vscode-icon-foreground)] bg-transparent border-[1px_solid_transparent] rounded'),
  rule('.figma-node-copy-button:hover', 'text-[var(--vscode-button-foreground)] bg-[var(--vscode-toolbar-hoverBackground)] border-color-[var(--vscode-panel-border)]'),
  rule('.figma-node-copy-button svg', 'size-[15px] fill-none stroke-current stroke-round stroke-width-[2]'),

  rule('.drop-zone', 'flex min-h-[180px] items-center justify-center p-[18px] mb-[16px] bg-[var(--vscode-input-background)] border-[2px_dashed_var(--vscode-input-border)] rounded-lg text-center'),
  rule('.drop-zone.is-dragging', 'border-color-[var(--vscode-focusBorder)] bg-[var(--vscode-list-hoverBackground)]'),
  rule('.drop-title', 'text-[var(--vscode-editor-foreground)] text-[15px] font-semibold mb-[8px]'),
  rule('.drop-copy', 'text-[var(--vscode-descriptionForeground)] text-[12px] leading-[1.5] mb-[14px]'),
  rule('.document-list', 'mt-[14px] border-t-[1px_solid_var(--vscode-panel-border)] pt-[14px]'),
  rule('.document-list h3', 'text-[13px] mb-[8px]'),
  rule('.document-item', 'flex items-center justify-between gap-[12px] p-[9px_0] border-b-[1px_solid_var(--vscode-panel-border)]'),
  rule('.document-name', 'text-[13px] font-medium'),
  rule('.link-button', 'flex-shrink-0 p-[6px_10px]'),
  rule('.upload-status', 'min-h-[20px] mt-[10px]'),
  rule('.upload-status.error', 'text-[var(--vscode-errorForeground)]'),

  raw('@media (max-width: 820px) {\n  .task-header {\n    flex-direction: column;\n  }\n\n  .task-manager-grid {\n    grid-template-columns: 1fr;\n  }\n\n  .create-grid {\n    grid-template-columns: 1fr;\n  }\n\n  .create-stepper {\n    grid-template-columns: 1fr;\n    gap: 14px;\n    padding: 14px;\n  }\n\n  .create-stepper-step {\n    grid-template-rows: 7px auto;\n  }\n\n  .task-block {\n    min-height: auto;\n  }\n}')
].join('\n\n');
