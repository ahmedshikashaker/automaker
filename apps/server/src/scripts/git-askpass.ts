/**
 * Simple script to be used as GIT_ASKPASS.
 * It just outputs the value of GITHUB_TOKEN environment variable.
 * Used to securely inject credentials into git commands without interactive prompts.
 */
console.log(process.env.GITHUB_TOKEN || '');
