interface CommitParts {
  type: string;
  scope?: string;
  description: string;
}

export function parseCommitMessage(message: string): CommitParts {
  // Default values
  const defaultResult: CommitParts = {
    type: 'chore',
    description: message,
  };

  // Try to match conventional commit format
  const match = message.match(/^(\w+)(?:\(([^)]+)\))?: (.+)$/);
  if (!match) return defaultResult;

  const [, type, scope, description] = match;

  // Validate type
  const validTypes = [
    'feat',
    'fix',
    'docs',
    'style',
    'refactor',
    'perf',
    'test',
    'build',
    'ci',
    'chore',
    'revert',
  ];

  return {
    type: validTypes.includes(type) ? type : defaultResult.type,
    scope: scope || undefined,
    description: description.trim(),
  };
}

export function formatCommitMessage(parts: CommitParts): string {
  const { type, scope, description } = parts;
  const scopePart = scope ? `(${scope})` : '';
  return `${type}${scopePart}: ${description}`;
}

export function suggestCommitType(files: string[]): string {
  // Analyze files to suggest commit type
  const hasTests = files.some(f => f.includes('test') || f.includes('spec'));
  const hasDocs = files.some(f => f.endsWith('.md') || f.includes('docs/'));
  const hasCI = files.some(f => f.includes('.github/') || f.includes('.circleci/'));
  const hasStyles = files.some(f => f.endsWith('.css') || f.endsWith('.scss'));

  if (hasTests) return 'test';
  if (hasDocs) return 'docs';
  if (hasCI) return 'ci';
  if (hasStyles) return 'style';

  // Default to feat for new files, fix for modifications
  return 'feat';
}

export function suggestScope(files: string[]): string | undefined {
  // Try to find common directory
  const dirs = files
    .map(f => f.split('/')[0])
    .filter(d => !d.startsWith('.'));

  if (dirs.length === 0) return undefined;

  // Find most common directory
  const dirCounts = dirs.reduce((acc, dir) => {
    acc[dir] = (acc[dir] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const [mostCommon] = Object.entries(dirCounts)
    .sort(([, a], [, b]) => b - a)[0] || [];

  return mostCommon;
} 