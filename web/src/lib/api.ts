export function getApiBase(): string {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('repotrace_api_base');
    if (custom && custom.trim()) {
      return custom.trim().replace(/\/$/, '');
    }
  }
  const envBase = (process.env.NEXT_PUBLIC_API_BASE || '').trim().replace(/\/$/, '');
  if (envBase) return envBase;

  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return 'https://repotrace-engine.onrender.com/api';
  }
  return 'http://localhost:4400/api';
}

export function setCustomApiBase(url: string): void {
  if (typeof window !== 'undefined') {
    let clean = url.trim().replace(/\/$/, '');
    if (clean && !clean.endsWith('/api') && !clean.includes('/api/')) {
      clean = `${clean}/api`;
    }
    if (clean) {
      localStorage.setItem('repotrace_api_base', clean);
    } else {
      localStorage.removeItem('repotrace_api_base');
    }
  }
}

export const API_BASE = getApiBase();

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
  const urls: string[] = [];
  const base = getApiBase();
  urls.push(`${base}/health`);
  if (typeof window !== 'undefined') {
    if (!urls.includes('http://localhost:4400/api/health')) {
      urls.push('http://localhost:4400/api/health');
    }
    if (!urls.includes('http://127.0.0.1:4400/api/health')) {
      urls.push('http://127.0.0.1:4400/api/health');
    }
  }

  const checkUrl = async (url: string): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        if (data && data.status === 'ok') return true;
      }
    } catch (e) {}
    throw new Error('Endpoint unreachable');
  };

  try {
    return await Promise.any(urls.map(u => checkUrl(u)));
  } catch (err) {
    return false;
  }
}

export async function fetchGitHubSession(): Promise<GitHubSession> {
  // Check browser localStorage first for instant instant hydration
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('repotrace_github_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.authenticated && parsed.user) {
          return parsed;
        }
      }
    } catch (e) {}
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`${getApiBase()}/auth/github/me`, { cache: 'no-store', signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (data && data.authenticated) {
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('repotrace_github_session', JSON.stringify(data));
          } catch (e) {}
        }
        return data;
      }
    }
  } catch (e) {}
  return { authenticated: false };
}

export async function fetchUserGitHubRepos(ownerOrUsername?: string): Promise<GitHubRepoItem[]> {
  // Get token and logged-in username from saved session
  let token = '';
  let sessionLogin = '';
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('repotrace_github_session');
      if (saved) {
        const session: GitHubSession = JSON.parse(saved);
        if (session.access_token) token = session.access_token;
        if (session.user?.login) sessionLogin = session.user.login;
      }
    } catch (e) {}
  }

  const targetUser = ownerOrUsername?.trim() || sessionLogin || '';

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'RepoTrace-Web'
  };
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  const mapRepo = (r: any): GitHubRepoItem => ({
    id: r.id,
    name: r.name,
    full_name: r.full_name,
    language: r.language || 'Code',
    private: Boolean(r.private),
    html_url: r.html_url,
    clone_url: r.clone_url || r.html_url,
    updated_at: r.updated_at,
    description: r.description || ''
  });

  // Helper: paginated fetch (GitHub returns max 100 per page, follows Link header)
  const fetchAllPages = async (baseUrl: string): Promise<GitHubRepoItem[]> => {
    const allRepos: GitHubRepoItem[] = [];
    let url: string | null = baseUrl;
    let pageCount = 0;
    while (url && pageCount < 10) { // safety limit: 10 pages = 1000 repos
      pageCount++;
      const res: Response = await fetch(url, { cache: 'no-store', headers });
      if (!res.ok) break;
      const data = await res.json();
      if (Array.isArray(data)) {
        allRepos.push(...data.map(mapRepo));
      }
      // Parse Link header for next page
      const link = res.headers.get('Link') || '';
      const nextMatch = link.match(/<([^>]+)>;\s*rel="next"/);
      url = nextMatch ? nextMatch[1] : null;
    }
    return allRepos;
  };

  // 1. Authenticated user repos (returns ALL repos including private, orgs)
  if (token) {
    try {
      const repos = await fetchAllPages('https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member');
      if (repos.length > 0) return repos;
    } catch (e) {}
  }

  // 2. Public repos by username (when no token but username known)
  if (targetUser) {
    try {
      const repos = await fetchAllPages(`https://api.github.com/users/${encodeURIComponent(targetUser)}/repos?per_page=100&sort=updated`);
      if (repos.length > 0) return repos;
    } catch (e) {}
  }

  // 3. Fallback to Backend Engine proxy
  try {
    const res = await fetch(`${getApiBase()}/github/repos`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.repositories) && data.repositories.length > 0) {
        return data.repositories;
      }
    }
  } catch (e) {}

  return [];
}

export async function loginGitHubDemo(): Promise<GitHubSession> {
  const session: GitHubSession = {
    authenticated: true,
    user: {
      login: "alex_dev",
      name: "Alex Dev (Enterprise)",
      avatar_url: "https://avatars.githubusercontent.com/u/583231?v=4",
      html_url: "https://github.com/octocat",
      public_repos: 14,
      total_private_repos: 6
    }
  };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('repotrace_github_session', JSON.stringify(session));
    } catch (e) {}
  }
  try {
    await fetch(`${getApiBase()}/auth/github/login_demo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {}
  return session;
}

export async function loginGitHubToken(token: string): Promise<GitHubSession> {
  const cleanToken = token.trim();
  if (!cleanToken) throw new Error('Token is required');

  // 1. Try backend server proxy
  try {
    const res = await fetch(`${getApiBase()}/auth/github/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: cleanToken })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.authenticated) {
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('repotrace_github_session', JSON.stringify(data));
          } catch (e) {}
        }
        return data;
      }
    }
  } catch (e) {}

  // 2. Direct GitHub API Fallback (Guaranteed to work 100% in browser)
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${cleanToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'RepoTrace-Web'
      }
    });

    if (res.ok) {
      const userData = await res.json();
      const session: GitHubSession = {
        authenticated: true,
        access_token: cleanToken,
        user: {
          login: userData.login,
          name: userData.name || userData.login,
          avatar_url: userData.avatar_url || 'https://avatars.githubusercontent.com/u/583231?v=4',
          html_url: userData.html_url,
          public_repos: userData.public_repos || 0,
          total_private_repos: userData.total_private_repos || 0
        }
      };
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('repotrace_github_session', JSON.stringify(session));
        } catch (e) {}
      }
      return session;
    } else {
      const errData = await res.json();
      throw new Error(errData.message || 'Invalid GitHub token. Please verify token permissions.');
    }
  } catch (err: any) {
    throw new Error(err.message || 'Failed to authenticate with GitHub token');
  }
}

export async function logoutGitHub(): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('repotrace_github_session');
    } catch (e) {}
  }
  try {
    await fetch(`${getApiBase()}/auth/github/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {}
}

export async function installGitHubWorkflow(repoFullName: string, branch: string = 'main'): Promise<WorkflowInstallResult> {
  const res = await fetch(`${getApiBase()}/github/install_workflow`, {
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
  const res = await fetch(`${getApiBase()}/extract`, {
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
  const res = await fetch(`${getApiBase()}/scan_repos`, {
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
  const res = await fetch(`${getApiBase()}/diff`, {
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
  const res = await fetch(`${getApiBase()}/pr-gate/status`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch PR gate status');
  return await res.json();
}

export async function addRepoToPRGate(owner: string, repo: string) {
  const res = await fetch(`${getApiBase()}/pr-gate/add-repo`, {
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
  const res = await fetch(`${getApiBase()}/pr-gate/trigger`, {
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
      `${getApiBase()}/github/latest-pr?owner=${encodeURIComponent(targetOwner)}&repo=${encodeURIComponent(targetRepo)}`,
      { cache: 'no-store', signal: controller.signal }
    );
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (data) {
        return {
          has_open_pr: Boolean(data.has_open_pr),
          number: data.has_open_pr ? (data.number || 0) : 0,
          head_branch: data.has_open_pr ? (data.head_branch || 'main') : 'main',
          base_branch: data.base_branch || 'main',
          html_url: data.has_open_pr ? (data.html_url || '') : '',
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
          head_branch: p.head?.ref || 'main',
          base_branch: p.base?.ref || 'main',
          html_url: p.html_url || `https://github.com/${targetOwner}/${targetRepo}/pull/${p.number}`
        }));

        const open_prs = all_prs.filter((p: any) => p.is_open);
        const has_open_pr = open_prs.length > 0;
        const targetPR = open_prs.length > 0 ? open_prs[0] : null;

        return {
          has_open_pr,
          number: targetPR ? targetPR.number : 0,
          head_branch: targetPR ? targetPR.head_branch : 'main',
          base_branch: targetPR ? targetPR.base_branch : 'main',
          html_url: targetPR ? targetPR.html_url : '',
          title: targetPR ? targetPR.title : '',
          state: targetPR ? targetPR.state : (all_prs.length > 0 ? 'closed' : 'none'),
          all_prs
        };
      }
    }
  } catch (e) {}

  return {
    has_open_pr: false,
    number: 0,
    head_branch: 'main',
    base_branch: 'main',
    html_url: '',
    title: '',
    state: 'none',
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
    const res = await fetch(`${getApiBase()}/config/gemini_key`, { cache: 'no-store' });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {}
  return { configured: false, key_masked: '', model: 'gemini-3.5-flash-lite' };
}

export async function saveGeminiApiKey(apiKey: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${getApiBase()}/config/gemini_key`, {
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
