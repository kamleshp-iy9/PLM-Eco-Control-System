import { AuthShell } from '@/components/auth/AuthShell';
import { LoginForm } from '@/components/auth/LoginForm';

export function LoginPage() {
  return (
    <AuthShell
      title="Engineering changes, executed with control."
      description="Sign in to review products, raise ECOs, approve manufacturing changes, and keep version history consistent across the system."
    >
      <LoginForm />
    </AuthShell>
  );
}
