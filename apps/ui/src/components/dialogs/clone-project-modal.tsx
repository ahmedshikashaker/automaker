import { useState, useEffect } from 'react';
import { createLogger } from '@automaker/utils/logger';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { HotkeyButton } from '@/components/ui/hotkey-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    FolderOpen,
    Loader2,
    Folder,
    Download
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFileBrowser } from '@/contexts/file-browser-context';
import { getDefaultWorkspaceDirectory, saveLastProjectDirectory } from '@/lib/workspace-config';

const logger = createLogger('CloneProjectModal');

interface ValidationErrors {
    repoUrl?: boolean;
    projectName?: boolean;
    parentPath?: boolean;
}

interface CloneProjectModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onClone: (repoUrl: string, projectName: string, parentPath: string, token?: string) => Promise<void>;
    isCloning: boolean;
}

export function CloneProjectModal({
    open,
    onOpenChange,
    onClone,
    isCloning,
}: CloneProjectModalProps) {
    const [repoUrl, setRepoUrl] = useState('');
    const [projectName, setProjectName] = useState('');
    const [parentPath, setParentPath] = useState('');
    const [token, setToken] = useState('');
    const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(false);
    const [errors, setErrors] = useState<ValidationErrors>({});
    const { openFileBrowser } = useFileBrowser();

    // Load default workspace
    useEffect(() => {
        if (open) {
            setIsLoadingWorkspace(true);
            getDefaultWorkspaceDirectory()
                .then((defaultDir) => {
                    if (defaultDir) {
                        setParentPath(defaultDir);
                    }
                })
                .catch((error) => {
                    logger.error('Failed to get default workspace directory:', error);
                })
                .finally(() => {
                    setIsLoadingWorkspace(false);
                });
        }
    }, [open]);

    // Reset form
    useEffect(() => {
        if (!open) {
            setRepoUrl('');
            setProjectName('');
            setToken('');
            setErrors({});
        }
    }, [open]);

    // Parse project name from URL
    useEffect(() => {
        if (repoUrl && !projectName) {
            try {
                const urlParts = repoUrl.split('/');
                const lastPart = urlParts[urlParts.length - 1];
                if (lastPart) {
                    const name = lastPart.replace('.git', '');
                    setProjectName(name);
                }
            } catch (e) {
                // Ignore
            }
        }
    }, [repoUrl, projectName]);

    const handleBrowseDirectory = async () => {
        const selectedPath = await openFileBrowser({
            title: 'Select Parent Directory',
            description: 'Choose the directory where the project will be cloned',
            initialPath: parentPath || undefined,
        });
        if (selectedPath) {
            setParentPath(selectedPath);
            saveLastProjectDirectory(selectedPath);
        }
    };

    const validateAndClone = async () => {
        const newErrors: ValidationErrors = {};

        if (!repoUrl.trim()) newErrors.repoUrl = true;
        if (!projectName.trim()) newErrors.projectName = true;
        if (!parentPath.trim()) newErrors.parentPath = true;

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setErrors({});
        await onClone(repoUrl, projectName, parentPath, token);
    };

    // Determine full path for display
    // Use platform-specific path separator (simplified check)
    const pathSep = navigator.platform.indexOf('Win') !== -1 ? '\\' : '/';
    const fullPath = parentPath && projectName ? `${parentPath}${pathSep}${projectName}` : '';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-card border-border max-w-md">
                <DialogHeader>
                    <DialogTitle>Clone from GitHub</DialogTitle>
                    <DialogDescription>
                        Clone an existing repository from GitHub to your local machine.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Repo URL */}
                    <div className="space-y-2">
                        <Label htmlFor="repo-url" className={cn(errors.repoUrl && 'text-red-500')}>
                            Repository URL {errors.repoUrl && <span className="text-red-500">*</span>}
                        </Label>
                        <Input
                            id="repo-url"
                            placeholder="https://github.com/username/repo"
                            value={repoUrl}
                            onChange={(e) => {
                                setRepoUrl(e.target.value);
                                if (errors.repoUrl) setErrors(prev => ({ ...prev, repoUrl: false }));
                            }}
                            className={cn(errors.repoUrl && 'border-red-500')}
                            autoFocus
                        />
                    </div>

                    {/* Project Name */}
                    <div className="space-y-2">
                        <Label htmlFor="project-name" className={cn(errors.projectName && 'text-red-500')}>
                            Project Name {errors.projectName && <span className="text-red-500">*</span>}
                        </Label>
                        <Input
                            id="project-name"
                            placeholder="repo-name"
                            value={projectName}
                            onChange={(e) => {
                                setProjectName(e.target.value);
                                if (errors.projectName) setErrors(prev => ({ ...prev, projectName: false }));
                            }}
                            className={cn(errors.projectName && 'border-red-500')}
                        />
                    </div>

                    {/* Access Token */}
                    <div className="space-y-2">
                        <Label htmlFor="access-token">
                            Access Token <span className="text-sm font-normal text-muted-foreground">(Optional)</span>
                        </Label>
                        <Input
                            id="access-token"
                            type="password"
                            placeholder="GitHub Personal Access Token"
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            Required for private repositories. The token will be saved securely for this project.
                        </p>
                    </div>

                    {/* Location */}
                    <div className="space-y-2">
                        <Label className={cn(errors.parentPath && 'text-red-500')}>
                            Location {errors.parentPath && <span className="text-red-500">*</span>}
                        </Label>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-2 rounded-md border border-border">
                            <Folder className="w-4 h-4 shrink-0" />
                            <div className="flex-1 min-w-0 truncate">
                                {fullPath || parentPath || 'Select a directory...'}
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={handleBrowseDirectory}
                                disabled={isLoadingWorkspace}
                            >
                                <FolderOpen className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <HotkeyButton
                        onClick={validateAndClone}
                        disabled={isCloning}
                        hotkey={{ key: 'Enter', cmdCtrl: true }}
                        hotkeyActive={open}
                        className="gap-2"
                    >
                        {isCloning ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Download className="w-4 h-4" />
                        )}
                        {isCloning ? 'Cloning...' : 'Clone Project'}
                    </HotkeyButton>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
