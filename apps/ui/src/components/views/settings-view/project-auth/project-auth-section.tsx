import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/app-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Github, Eye, EyeOff, Loader2, CheckCircle2, Key } from 'lucide-react';
import { getElectronAPI } from '@/lib/electron';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
// Replaced Alert with Tailwind
// import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function ProjectAuthSection() {
  const { currentProject } = useAppStore();

  // State for GitHub Token form
  const [githubToken, setGithubToken] = useState('');
  const [showGithubToken, setShowGithubToken] = useState(false);
  const [isSavingGithub, setIsSavingGithub] = useState(false);
  const [githubSaved, setGithubSaved] = useState(false);
  const [isCheckingGithub, setIsCheckingGithub] = useState(false);
  const [hasGithubToken, setHasGithubToken] = useState(false);
  const [isRemovingGithub, setIsRemovingGithub] = useState(false);

  // Load current settings when project changes
  useEffect(() => {
    if (currentProject) {
      checkGithubTokenStatus(currentProject.path);
    }
  }, [currentProject]);

  const checkGithubTokenStatus = async (projectPath: string) => {
    setIsCheckingGithub(true);
    try {
      const api = getElectronAPI();
      if (api.github && api.github.getAuth) {
        const result = await api.github.getAuth(projectPath);
        if (result.success) {
          setHasGithubToken(!!result.hasToken);
        }
      }
    } catch (error) {
      console.error('Failed to check GitHub token:', error);
    } finally {
      setIsCheckingGithub(false);
    }
  };

  const handleSaveGithub = async () => {
    if (!currentProject || !githubToken) return;

    setIsSavingGithub(true);
    try {
      const api = getElectronAPI();
      if (!api.github?.setAuth) {
        throw new Error('GitHub API not available');
      }

      const result = await api.github.setAuth(currentProject.path, githubToken);

      if (result.success) {
        setGithubSaved(true);
        setGithubToken(''); // Clear input for security
        setShowGithubToken(false);
        setHasGithubToken(true);
        setTimeout(() => setGithubSaved(false), 2000);
        toast.success('GitHub token set for this project');
      } else {
        throw new Error(result.error || 'Failed to set GitHub token');
      }
    } catch (error) {
      toast.error('Failed to set GitHub token');
      console.error(error);
    } finally {
      setIsSavingGithub(false);
    }
  };

  const handleRemoveGithub = async () => {
    if (!currentProject) return;

    setIsRemovingGithub(true);
    try {
      const api = getElectronAPI();
      if (!api.github?.removeAuth) {
        throw new Error('GitHub API not available');
      }

      const result = await api.github.removeAuth(currentProject.path);

      if (result.success) {
        setHasGithubToken(false);
        toast.success('GitHub token removed');
      } else {
        throw new Error(result.error || 'Failed to remove GitHub token');
      }
    } catch (error) {
      toast.error('Failed to remove GitHub token');
      console.error(error);
    } finally {
      setIsRemovingGithub(false);
    }
  };

  if (!currentProject) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        Please select a project to configure authentication.
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Project Authentication</h2>
        <p className="text-muted-foreground mt-2">
          Manage API keys and authentication tokens specific to{' '}
          <strong>{currentProject.name}</strong>. These settings override global configurations.
        </p>
      </div>

      {/* GitHub Token Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-white/5">
          <div className="p-2 rounded-lg bg-zinc-800">
            <Github className="w-5 h-5 text-white" />
          </div>
          <h3 className="font-medium text-lg">GitHub Personal Access Token</h3>
        </div>

        <div className="space-y-4 bg-black/20 p-6 rounded-xl border border-white/5">
          <div className="flex items-center justify-between">
            <Label htmlFor="github-token">Project-specific Token</Label>
            {isCheckingGithub ? (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Checking status...
              </span>
            ) : hasGithubToken ? (
              <span className="text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded-full border border-green-500/20 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Token Set
              </span>
            ) : (
              <span className="text-xs text-muted-foreground bg-white/5 px-2 py-1 rounded-full">
                No Token Set
              </span>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="github-token"
                  type={showGithubToken ? 'text' : 'password'}
                  placeholder={hasGithubToken ? 'Enter new token to update...' : 'ghp_...'}
                  className="pr-10 bg-black/20 border-white/10"
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowGithubToken(!showGithubToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showGithubToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Button
                onClick={handleSaveGithub}
                disabled={isSavingGithub || !githubToken}
                className="min-w-[100px]"
              >
                {isSavingGithub ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : githubSaved ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  'Set Token'
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Required for accessing private repositories or higher rate limits.
            </p>
          </div>

          {hasGithubToken && (
            <div className="pt-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleRemoveGithub}
                disabled={isRemovingGithub}
                className="bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20"
              >
                {isRemovingGithub ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Remove Token
              </Button>
            </div>
          )}
          <div className="rounded-lg border p-3 flex items-start gap-3 bg-blue-500/10 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400">
            <Key className="h-4 w-4 mt-0.5" />
            <div>
              <h5 className="font-medium leading-none mb-1">About GitHub Tokens</h5>
              <div className="text-sm opacity-90">
                <p className="mb-1">
                  This token is stored locally for this project only. Use this if you need to access
                  repositories that your global git credentials cannot access, or if you want to
                  override the global configuration.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
