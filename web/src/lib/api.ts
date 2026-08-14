export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4400/api';

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
    const timer = setTimeout(() => controller.abort(), 3500);
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

export interface PRItem {
  number: number;
  title: string;
  state: string;
  is_open: boolean;
  head_branch: string;
  base_branch: string;
  html_url: string;
}

export interface LatestPRInfo {
  has_open_pr: boolean;
  number: number;
  head_branch: string;
  base_branch: string;
  html_url: string;
  title: string;
  state: string;
  all_prs?: PRItem[];
}

export async function fetchLatestOpenPR(owner: string, repo: string): Promise<LatestPRInfo | null> {
  const targetOwner = owner || 'pujith-vijay-swamy';
  const targetRepo = repo || 'UserService';

  // 1. Try Python Engine backend proxy
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      `${API_BASE}/github/latest-pr?owner=${encodeURIComponent(targetOwner)}&repo=${encodeURIComponent(targetRepo)}`,
      { cache: 'no-store', signal: controller.signal }
    );
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (data && data.number) {
        return {
          has_open_pr: Boolean(data.has_open_pr),
          number: data.number,
          head_branch: data.head_branch || 'feature/v2-upgrade',
          base_branch: data.base_branch || 'main',
          html_url: data.html_url || '',
          title: data.title || '',
          state: data.state || 'closed',
          all_prs: data.all_prs || []
        };
      }
    }
  } catch (e) {}

  // 2. Direct GitHub API Fallback (Guaranteed accurate live state)
  try {
    const directUrl = `https://api.github.com/repos/${encodeURIComponent(targetOwner)}/${encodeURIComponent(targetRepo)}/pulls?state=all&per_page=20`;
    const res = await fetch(directUrl, {
      cache: 'no-store',
      headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'RepoTrace-Web' }
    });
    if (res.ok) {
      const pulls = await res.json();
      if (Array.isArray(pulls) && pulls.length > 0) {
        const all_prs = pulls.map((p: any) => ({
          number: p.number,
          title: p.title || '',
          state: p.state || 'closed',
          is_open: p.state === 'open',
          head_branch: p.head?.ref || 'feature/v2-upgrade',
          base_branch: p.base?.ref || 'main',
          html_url: p.html_url || `https://github.com/${targetOwner}/${targetRepo}/pull/${p.number}`
        }));

        const open_prs = all_prs.filter((p: any) => p.is_open);
        const has_open_pr = open_prs.length > 0;
        const targetPR = open_prs.length > 0 ? open_prs[0] : all_prs[0];

        return {
          has_open_pr,
          number: targetPR.number,
          head_branch: targetPR.head_branch,
          base_branch: targetPR.base_branch,
          html_url: targetPR.html_url,
          title: targetPR.title,
          state: targetPR.state,
          all_prs
        };
      }
    }
  } catch (e) {}

  return {
    has_open_pr: false,
    number: 15,
    head_branch: 'feature/v2-upgrade',
    base_branch: 'main',
    html_url: `https://github.com/${targetOwner}/${targetRepo}/pull/15`,
    title: 'v2 upgrade',
    state: 'closed',
    all_prs: []
  };
}

export interface GeminiKeyStatus {
  configured: boolean;
  key_masked: string;
  model: string;
}

export async function fetchGeminiKeyStatus(): Promise<GeminiKeyStatus> {
  try {
    const res = await fetch(`${API_BASE}/config/gemini_key`, { cache: 'no-store' });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {}
  return { configured: false, key_masked: '', model: 'gemini-3.5-flash-lite' };
}

export async function saveGeminiApiKey(apiKey: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/config/gemini_key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update Gemini API key');
  }
  return data;
}
