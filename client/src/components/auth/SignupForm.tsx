import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { REQUESTABLE_ROLES, ROLE_LABELS } from '@/lib/constants';

interface SignupFormState {
  name: string;
  loginId: string;
  email: string;
  requestedRole: string;
  password: string;
  confirmPassword: string;
}

export function SignupForm() {
  const navigate = useNavigate();
  const { signup, isLoading, error, clearError } = useAuthStore();
  const [formData, setFormData] = useState<SignupFormState>({
    name: '',
    loginId: '',
    email: '',
    requestedRole: REQUESTABLE_ROLES.ENGINEERING_USER,
    password: '',
    confirmPassword: '',
  });
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setValidationError(null);
    clearError();
  };

  const validateForm = (): boolean => {
    if (formData.loginId.length < 6 || formData.loginId.length > 12) {
      setValidationError('Login ID must be between 6-12 characters');
      return false;
    }

    if (formData.password.length <= 8) {
      setValidationError('Password must be more than 8 characters');
      return false;
    }

    if (!/[a-z]/.test(formData.password)) {
      setValidationError('Password must contain at least one lowercase letter');
      return false;
    }

    if (!/[A-Z]/.test(formData.password)) {
      setValidationError('Password must contain at least one uppercase letter');
      return false;
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(formData.password)) {
      setValidationError('Password must contain at least one special character');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
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
      await signup({
        name: formData.name,
        loginId: formData.loginId,
        email: formData.email,
        requestedRole: formData.requestedRole,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
      });
      navigate('/login');
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
        <CardTitle className="text-2xl text-center">Sign Up</CardTitle>
        <CardDescription className="text-center">
          Create a new account to access the PLM system
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {(error || validationError) && (
            <Alert variant="destructive">
              <AlertDescription>{error || validationError}</AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="Enter your full name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="loginId">Login ID</Label>
            <Input
              id="loginId"
              name="loginId"
              type="text"
              placeholder="Enter login ID (6-12 characters)"
              value={formData.loginId}
              onChange={handleChange}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="requestedRole">Requested Role</Label>
            <Select
              value={formData.requestedRole}
              onValueChange={(value) => {
                setFormData({ ...formData, requestedRole: value });
                setValidationError(null);
                clearError();
              }}
            >
              <SelectTrigger id="requestedRole">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {Object.values(REQUESTABLE_ROLES).map((role) => (
                  <SelectItem key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              An administrator will review and approve this role before you can log in.
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Enter password (8+ chars, upper, lower, special)"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Re-Enter Password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="Confirm your password"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
            />
          </div>
          
          <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating request...
              </>
            ) : (
              'REQUEST ACCESS'
            )}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center border-t border-border/60 pt-6">
        <div className="text-sm">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary transition-colors hover:text-primary/80">
            Sign In
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
