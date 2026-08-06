const API_BASE = 'http://localhost:4400/api';

export interface HealthCheckResponse {
  status: string;
  version: string;
  engine: string;
}

export interface GitHubUser {
  login: string;
  name: string;
  avatar_url: string;
  html_url?: string;
  public_repos?: number;
  total_private_repos?: number;
}

export interface GitHubSession {
  authenticated: boolean;
  user?: GitHubUser;
  access_token?: string;
}

export interface GitHubRepoItem {
  id: number;
  name: string;
  full_name: string;
  language: string;
  private: boolean;
  html_url: string;
  clone_url: string;
  updated_at: string;
  description: string;
}

export interface WorkflowInstallResult {
  success: boolean;
  repo: string;
  file: string;
  commit_url: string;
  pr_url: string;
  message: string;
}

export async function checkEngineHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`${API_BASE}/health`, { cache: 'no-store', signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data: HealthCheckResponse = await res.json();
      return data.status === 'ok';
    }
  } catch (e) {
    // Engine server is offline or timed out
  }
  return false;
}

export async function fetchGitHubSession(): Promise<GitHubSession> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`${API_BASE}/auth/github/me`, { cache: 'no-store', signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {}
  return { authenticated: false };
}

export async function fetchUserGitHubRepos(): Promise<GitHubRepoItem[]> {
  try {
    const res = await fetch(`${API_BASE}/github/repos`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      return data.repositories || [];
    }
  } catch (e) {}
  return [];
}

export async function loginGitHubDemo(): Promise<GitHubSession> {
  const res = await fetch(`${API_BASE}/auth/github/login_demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  return await res.json();
}

export async function loginGitHubToken(token: string): Promise<GitHubSession> {
  const res = await fetch(`${API_BASE}/auth/github/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token })
  });
  if (!res.ok) {
    const errData = await res.json();
    throw new Error(errData.error || 'Failed to authenticate with GitHub token.');
  }
  return await res.json();
}

export async function logoutGitHub(): Promise<void> {
  await fetch(`${API_BASE}/auth/github/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function installGitHubWorkflow(repoFullName: string, branch: string = 'main'): Promise<WorkflowInstallResult> {
  const res = await fetch(`${API_BASE}/github/install_workflow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_full_name: repoFullName, branch })
  });
  if (!res.ok) {
    throw new Error('Failed to install GitHub Actions workflow.');
  }
  return await res.json();
}

export async function extractSingleRepo(sourceDir: string, serviceName: string = '') {
  const res = await fetch(`${API_BASE}/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_dir: sourceDir, service_name: serviceName })
  });
  if (!res.ok) {
    throw new Error('Failed to extract contract from source directory.');
  }
  return await res.json();
}

export async function scanMultipleRepos(repos: { dir: string; name?: string }[]) {
  const res = await fetch(`${API_BASE}/scan_repos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repositories: repos })
  });

  if (!res.ok) {
    const errData = await res.json();
    throw new Error(errData.error || 'Failed to analyze microservice repositories.');
  }
  return await res.json();
}

export async function diffContracts(oldContract: any, newContract: any) {
  const res = await fetch(`${API_BASE}/diff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ old_contract: oldContract, new_contract: newContract })
  });
  if (!res.ok) {
    throw new Error('Failed to diff contracts.');
  }
  return await res.json();
}

export async function fetchPRGateStatus() {
  const res = await fetch(`${API_BASE}/pr-gate/status`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch PR gate status');
  return await res.json();
}

export async function addRepoToPRGate(owner: string, repo: string) {
  const res = await fetch(`${API_BASE}/pr-gate/add-repo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ owner, repo })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to add repo to PR Gate');
  }
  return await res.json();
}

export async function triggerPRGateCheck() {
  const res = await fetch(`${API_BASE}/pr-gate/trigger`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to trigger PR check');
  }
  return await res.json();
}
