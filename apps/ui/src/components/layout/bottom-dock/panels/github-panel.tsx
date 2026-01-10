import { useState, useCallback, useEffect, useRef } from 'react';
import {
  CircleDot,
  GitPullRequest,
  RefreshCw,
  ExternalLink,
  Loader2,
  Wand2,
  CheckCircle,
  Clock,
  X,
} from 'lucide-react';
import {
  getElectronAPI,
  GitHubIssue,
  GitHubPR,
  IssueValidationResult,
  StoredValidation,
} from '@/lib/electron';
import { useAppStore, GitHubCacheIssue, GitHubCachePR } from '@/store/app-store';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useIssueValidation } from '@/components/views/github-issues-view/hooks';
import { ValidationDialog } from '@/components/views/github-issues-view/dialogs';
import { useModelOverride } from '@/components/shared';
import { toast } from 'sonner';

type GitHubTab = 'issues' | 'prs';

// Cache duration: 5 minutes
const CACHE_DURATION_MS = 5 * 60 * 1000;

// Check if validation is stale (> 24 hours)
function isValidationStale(validatedAt: string): boolean {
  const VALIDATION_CACHE_TTL_HOURS = 24;
  const validatedTime = new Date(validatedAt).getTime();
  const hoursSinceValidation = (Date.now() - validatedTime) / (1000 * 60 * 60);
  return hoursSinceValidation > VALIDATION_CACHE_TTL_HOURS;
}

export function GitHubPanel() {
  const { currentProject, getGitHubCache, setGitHubCache, setGitHubCacheFetching } = useAppStore();
  const [activeTab, setActiveTab] = useState<GitHubTab>('issues');
  const [selectedIssue, setSelectedIssue] = useState<GitHubIssue | null>(null);
  const [validationResult, setValidationResult] = useState<IssueValidationResult | null>(null);
  const [showValidationDialog, setShowValidationDialog] = useState(false);
  const fetchingRef = useRef(false);

  const projectPath = currentProject?.path || '';
  const cache = getGitHubCache(projectPath);

  const issues = cache?.issues || [];
  const prs = cache?.prs || [];
  const isFetching = cache?.isFetching || false;
  const lastFetched = cache?.lastFetched || null;
  const hasCache = issues.length > 0 || prs.length > 0 || lastFetched !== null;

  // Model override for validation
  const validationModelOverride = useModelOverride({ phase: 'validationModel' });

  // Use the issue validation hook
  const { validatingIssues, cachedValidations, handleValidateIssue, handleViewCachedValidation } =
    useIssueValidation({
      selectedIssue,
      showValidationDialog,
      onValidationResultChange: setValidationResult,
      onShowValidationDialogChange: setShowValidationDialog,
    });

  const fetchData = useCallback(
    async (isBackgroundRefresh = false) => {
      if (!projectPath || fetchingRef.current) return;

      fetchingRef.current = true;
      if (!isBackgroundRefresh) {
        setGitHubCacheFetching(projectPath, true);
      }

      try {
        const api = getElectronAPI();
        const fetchedIssues: GitHubCacheIssue[] = [];
        const fetchedPrs: GitHubCachePR[] = [];

        // Fetch issues
        if (api.github?.listIssues) {
          const issuesResult = await api.github.listIssues(projectPath);
          if (issuesResult.success && issuesResult.openIssues) {
            // Map to cache format
            fetchedIssues.push(
              ...issuesResult.openIssues.slice(0, 20).map((issue: GitHubIssue) => ({
                number: issue.number,
                title: issue.title,
                url: issue.url,
                author: issue.author,
              }))
            );
          }
        }

        // Fetch PRs
        if (api.github?.listPRs) {
          const prsResult = await api.github.listPRs(projectPath);
          if (prsResult.success && prsResult.openPRs) {
            // Map to cache format
            fetchedPrs.push(
              ...prsResult.openPRs.slice(0, 20).map((pr: GitHubPR) => ({
                number: pr.number,
                title: pr.title,
                url: pr.url,
                author: pr.author,
              }))
            );
          }
        }

        setGitHubCache(projectPath, { issues: fetchedIssues, prs: fetchedPrs });
      } catch (error) {
        console.error('Error fetching GitHub data:', error);
        // On error, just mark as not fetching but keep existing cache
        setGitHubCacheFetching(projectPath, false);
      } finally {
        fetchingRef.current = false;
      }
    },
    [projectPath, setGitHubCache, setGitHubCacheFetching]
  );

  // Initial fetch or refresh if cache is stale
  useEffect(() => {
    if (!projectPath) return;

    const isCacheStale = !lastFetched || Date.now() - lastFetched > CACHE_DURATION_MS;

    if (!hasCache) {
      // No cache, do initial fetch (show spinner)
      fetchData(false);
    } else if (isCacheStale && !isFetching) {
      // Cache is stale, refresh in background (no spinner, show cached data)
      fetchData(true);
    }
  }, [projectPath, hasCache, lastFetched, isFetching, fetchData]);

  // Auto-refresh interval
  useEffect(() => {
    if (!projectPath) return;

    const interval = setInterval(() => {
      const currentCache = getGitHubCache(projectPath);
      const isStale =
        !currentCache?.lastFetched || Date.now() - currentCache.lastFetched > CACHE_DURATION_MS;

      if (isStale && !fetchingRef.current) {
        fetchData(true);
      }
    }, CACHE_DURATION_MS);

    return () => clearInterval(interval);
  }, [projectPath, getGitHubCache, fetchData]);

  const handleRefresh = useCallback(() => {
    fetchData(false);
  }, [fetchData]);

  const handleOpenInGitHub = useCallback((url: string) => {
    const api = getElectronAPI();
    api.openExternalLink(url);
  }, []);

  // Handle validation for an issue (converts cache issue to GitHubIssue format)
  const handleValidate = useCallback(
    (cacheIssue: GitHubCacheIssue) => {
      // Convert cache issue to GitHubIssue format for validation
      const issue: GitHubIssue = {
        number: cacheIssue.number,
        title: cacheIssue.title,
        url: cacheIssue.url,
        author: cacheIssue.author || { login: 'unknown' },
        state: 'OPEN',
        body: '',
        createdAt: new Date().toISOString(),
        labels: [],
        comments: { totalCount: 0 },
      };
      setSelectedIssue(issue);
      handleValidateIssue(issue, {
        modelEntry: validationModelOverride.effectiveModelEntry,
      });
    },
    [handleValidateIssue, validationModelOverride.effectiveModelEntry]
  );

  // Handle viewing cached validation
  const handleViewValidation = useCallback(
    (cacheIssue: GitHubCacheIssue) => {
      // Convert cache issue to GitHubIssue format
      const issue: GitHubIssue = {
        number: cacheIssue.number,
        title: cacheIssue.title,
        url: cacheIssue.url,
        author: cacheIssue.author || { login: 'unknown' },
        state: 'OPEN',
        body: '',
        createdAt: new Date().toISOString(),
        labels: [],
        comments: { totalCount: 0 },
      };
      setSelectedIssue(issue);
      handleViewCachedValidation(issue);
    },
    [handleViewCachedValidation]
  );

  // Get validation status for an issue
  const getValidationStatus = useCallback(
    (issueNumber: number) => {
      const isValidating = validatingIssues.has(issueNumber);
      const cached = cachedValidations.get(issueNumber);
      const isStale = cached ? isValidationStale(cached.validatedAt) : false;
      return { isValidating, cached, isStale };
    },
    [validatingIssues, cachedValidations]
  );

  // Only show loading spinner if no cached data AND fetching
  if (!hasCache && isFetching) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header with tabs */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('issues')}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors',
              activeTab === 'issues'
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <CircleDot className="h-3 w-3" />
            Issues ({issues.length})
          </button>
          <button
            onClick={() => setActiveTab('prs')}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors',
              activeTab === 'prs'
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <GitPullRequest className="h-3 w-3" />
            PRs ({prs.length})
          </button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={handleRefresh}
          disabled={isFetching}
        >
          <RefreshCw className={cn('h-3 w-3', isFetching && 'animate-spin')} />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-2 space-y-1">
          {activeTab === 'issues' ? (
            issues.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No open issues</p>
            ) : (
              issues.map((issue) => {
                const { isValidating, cached, isStale } = getValidationStatus(issue.number);

                return (
                  <div
                    key={issue.number}
                    className="flex items-start gap-2 p-2 rounded-md hover:bg-accent/50 group"
                  >
                    <CircleDot className="h-3.5 w-3.5 mt-0.5 text-green-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{issue.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        #{issue.number} opened by {issue.author?.login}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Validation status/action */}
                      {isValidating ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      ) : cached && !isStale ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewValidation(issue);
                          }}
                          title="View validation result"
                        >
                          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                        </Button>
                      ) : cached && isStale ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleValidate(issue);
                          }}
                          title="Re-validate (stale)"
                        >
                          <Clock className="h-3.5 w-3.5 text-yellow-500" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5 opacity-0 group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleValidate(issue);
                          }}
                          title="Validate with AI"
                        >
                          <Wand2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {/* Open in GitHub */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 opacity-0 group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenInGitHub(issue.url);
                        }}
                        title="Open in GitHub"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )
          ) : prs.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No open pull requests</p>
          ) : (
            prs.map((pr) => (
              <div
                key={pr.number}
                className="flex items-start gap-2 p-2 rounded-md hover:bg-accent/50 cursor-pointer group"
                onClick={() => handleOpenInGitHub(pr.url)}
              >
                <GitPullRequest className="h-3.5 w-3.5 mt-0.5 text-purple-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{pr.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    #{pr.number} by {pr.author?.login}
                  </p>
                </div>
                <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 text-muted-foreground" />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Validation Dialog */}
      <ValidationDialog
        open={showValidationDialog}
        onOpenChange={setShowValidationDialog}
        issue={selectedIssue}
        validationResult={validationResult}
        onConvertToTask={() => {
          // Task conversion not supported in dock panel - need to go to full view
          toast.info('Open GitHub Issues view for task conversion');
        }}
      />
    </div>
  );
}
