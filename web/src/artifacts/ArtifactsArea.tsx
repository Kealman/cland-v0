import type { AreaContentProps, AreaModule } from '../AreaSlot.tsx';
import { AreaObjects, AreaObjectDetail } from '../AreaObjects.tsx';

function ArtifactsArea(props: AreaContentProps) {
  return <section data-area-module="Artifacts" data-area-surface="pane" data-key-context="artifacts"><AreaObjects {...props} /></section>;
}
function ArtifactPage(props: AreaContentProps) {
  return <section data-area-module="Artifacts" data-area-surface="page" data-key-context="artifacts"><AreaObjectDetail {...props} /></section>;
}
function ArtifactDrawer(props: AreaContentProps) {
  return <section data-area-module="Artifacts" data-area-surface="drawer" data-key-context="artifacts"><AreaObjectDetail {...props} /></section>;
}
export const artifactsModule: AreaModule = { context: 'artifacts', handledActions: [], Pane: ArtifactsArea, Page: ArtifactPage, Drawer: ArtifactDrawer };
