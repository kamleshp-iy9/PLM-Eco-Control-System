import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

export function ForgotPasswordForm() {
  const navigate = useNavigate();
  const { forgotPassword, isLoading, error, clearError } = useAuthStore();
  const [loginIdOrEmail, setLoginIdOrEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const validateForm = (): boolean => {
    if (newPassword.length <= 8) {
      setValidationError('Password must be more than 8 characters');
      return false;
    }

    if (!/[a-z]/.test(newPassword)) {
      setValidationError('Password must contain at least one lowercase letter');
      return false;
    }

    if (!/[A-Z]/.test(newPassword)) {
      setValidationError('Password must contain at least one uppercase letter');
      return false;
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
      setValidationError('Password must contain at least one special character');
      return false;
    }

    if (newPassword !== confirmPassword) {
      setValidationError('Passwords do not match');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setValidationError(null);

    if (!validateForm()) {
      return;
    }

    try {
      await forgotPassword(loginIdOrEmail, newPassword);
      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (error) {
      // Error is handled in the store
    }
  };

  return (
    <Card variant="floating" className="w-full max-w-md border-border/70">
      <CardHeader className="space-y-1 pb-2">
        <div className="flex justify-center mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/12 shadow-[var(--plm-shadow-button)]">
            <span className="text-xl font-bold text-primary">P</span>
          </div>
        </div>
        <CardTitle className="text-2xl text-center">Reset Password</CardTitle>
        <CardDescription className="text-center">
          Enter your login ID or email to reset your password
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {(error || validationError) && (
            <Alert variant="destructive">
              <AlertDescription>{error || validationError}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert>
              <AlertDescription>
                Password reset successful! Redirecting to login...
              </AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="loginIdOrEmail">Login ID or Email</Label>
            <Input
              id="loginIdOrEmail"
              type="text"
              placeholder="Enter your login ID or email"
              value={loginIdOrEmail}
              onChange={(e) => setLoginIdOrEmail(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              type="password"
              placeholder="Enter new password (8+ chars, upper, lower, special)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Confirm your new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          
          <Button type="submit" size="lg" className="w-full" disabled={isLoading || success}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Resetting password...
              </>
            ) : (
              'RESET PASSWORD'
            )}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center border-t border-border/60 pt-6">
        <div className="text-sm">
          Remember your password?{' '}
          <Link to="/login" className="font-medium text-primary transition-colors hover:text-primary/80">
            Sign In
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
