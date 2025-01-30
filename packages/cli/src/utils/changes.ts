import { exec } from 'child_process';
import { promisify } from 'util';
import { parseCommitMessage } from './commit';

const execAsync = promisify(exec);

interface FileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
}

interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  date: string;
}

interface ChangeAnalysis {
  type: string;
  scope?: string;
  description: string;
  files: FileChange[];
  commits: CommitInfo[];
  stats: {
    additions: number;
    deletions: number;
    filesChanged: number;
  };
}

export async function analyzeChanges(branch: string, base: string): Promise<ChangeAnalysis> {
  // Get list of commits
  const { stdout: commitsOutput } = await execAsync(
    `git log ${base}..${branch} --pretty=format:"%H|%s|%an|%ad"`
  );
  
  const commits = commitsOutput.split('\n').filter(Boolean).map(line => {
    const [hash, message, author, date] = line.split('|');
    return { hash, message, author, date };
  });

  // Get file changes
  const { stdout: diffOutput } = await execAsync(
    `git diff ${base}..${branch} --numstat`
  );

  const files = diffOutput.split('\n').filter(Boolean).map(line => {
    const [additions, deletions, path] = line.split('\t');
    return {
      path,
      status: 'modified', // We'll update this below
      additions: parseInt(additions, 10),
      deletions: parseInt(deletions, 10),
    };
  });

  // Get file statuses
  const { stdout: statusOutput } = await execAsync(
    `git diff ${base}..${branch} --name-status`
  );

  statusOutput.split('\n').filter(Boolean).forEach(line => {
    const [status, path] = line.split('\t');
    const file = files.find(f => f.path === path);
    if (file) {
      file.status = status === 'A' ? 'added' 
        : status === 'D' ? 'deleted'
        : status === 'R' ? 'renamed'
        : 'modified';
    }
  });

  // Calculate stats
  const stats = {
    additions: files.reduce((sum, file) => sum + file.additions, 0),
    deletions: files.reduce((sum, file) => sum + file.deletions, 0),
    filesChanged: files.length,
  };

  // Analyze commit messages to determine type and scope
  const lastCommit = commits[0];
  const { type, scope, description } = parseCommitMessage(lastCommit.message);

  return {
    type,
    scope,
    description,
    files,
    commits,
    stats,
  };
} 