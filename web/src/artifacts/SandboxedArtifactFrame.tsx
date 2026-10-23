import s from './Artifacts.module.css';

/** Artifact scripts run in an opaque origin, with the hub's sandbox policy too. */
export function SandboxedArtifactFrame({ url, title }: { url: string; title: string }) {
  return <iframe className={s.frame} title={title} src={url} sandbox="allow-scripts" />;
}
