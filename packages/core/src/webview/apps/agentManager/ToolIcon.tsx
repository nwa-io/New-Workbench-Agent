import { siAnthropic, siGit, siGithub, siOpenai } from 'simple-icons';

interface IconData {
  path: string;
}

// Only the brand icons referenced by tools.ts are bundled (tree-shaken). The
// Cursor icon is not in simple-icons, so it falls back to an empty box — the
// same behavior the previous CDN-based implementation had for missing icons.
const ICONS: Record<string, IconData> = {
  anthropic: siAnthropic,
  git: siGit,
  github: siGithub,
  openai: siOpenai
};

export function ToolIcon({ slug }: { slug: string }): JSX.Element {
  const icon = ICONS[slug];
  if (!icon) {
    return <div style={{ width: 20, height: 20 }} />;
  }
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="currentColor"
      className="tool-icon"
    >
      <path d={icon.path} />
    </svg>
  );
}
