import { AuthShell } from '@/components/auth/AuthShell';
import { ForgotPasswordForm } from '@/components/auth/ForgotPassword';

export function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset credentials without leaving the workflow."
      description="Update your password and return to the approval queue, reports, and master data screens with minimal interruption."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
