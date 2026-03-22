import { AuthShell } from '@/components/auth/AuthShell';
import { SignupForm } from '@/components/auth/SignupForm';

export function SignupPage() {
  return (
    <AuthShell
      title="Request access to the PLM workspace."
      description="Create your profile, request your role, and submit it for administrator approval before your first sign-in."
    >
      <SignupForm />
    </AuthShell>
  );
}
