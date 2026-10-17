// Human override covers tracker and documentation only; configuration and executable skill instructions need review.
const MERGE_OVERRIDE_PATHS = {
  directories: ['.cland/tasks/', 'docs/', 'qa/briefs/'],
  files: ['.cland/RULES.md', 'GLOSSARY.md'],
  basenames: ['README.md'],
};

/** Both sides of renames are supplied by the territory's changed-path census. */
export function refusedOverridePaths(files: readonly string[]): string[] {
  return files.filter(file => !MERGE_OVERRIDE_PATHS.directories.some(dir => file.startsWith(dir))
    && !MERGE_OVERRIDE_PATHS.files.includes(file)
    && !MERGE_OVERRIDE_PATHS.basenames.some(name => file === name || file.endsWith('/' + name)));
}
