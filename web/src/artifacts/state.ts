import type { Artifact } from '../../../shared/wire/index.ts';

export type ArtifactInventoryPage = { artifacts: Artifact[]; more?: boolean; before?: string };
export type ArtifactsState = {
  artifacts?: Artifact[];
  artifactsBefore?: string | undefined;
  artifactsLoading?: boolean;
  artifactsError?: string | undefined;
  loadMoreArtifacts?: () => Promise<void>;
};

export function replaceArtifact(rows: Artifact[] = [], artifact: Artifact): Artifact[] {
  // Match artifact.list: moved children belong to their folder, never this inventory.
  if (artifact.movedTo) return rows.filter(row => row.id !== artifact.id);
  return rows.some(row => row.id === artifact.id)
    ? rows.map(row => row.id === artifact.id ? artifact : row) : [...rows, artifact].sort((left, right) => Number(right.id.slice(2)) - Number(left.id.slice(2)));
}
