export interface RepoContext {
  owner: string;
  repo: string;
  branch: string;
  files: {
    path: string;
    content: string;
  }[];
}

export interface PRParams {
  title: string;
  description: string;
  headBranch: string;
  baseBranch: string;
  isDraft?: boolean;
  reviewers?: string[];
}

export interface PRPlan {
  files: {
    path: string;
    action: 'create' | 'modify' | 'delete';
    content?: string;
    diff?: string;
  }[];
  pr: {
    title: string;
    description: string;
    reviewers: string[];
  };
} 