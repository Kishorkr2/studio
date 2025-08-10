'use client';

import {useState} from 'react';
import Link from 'next/link';
import {useRouter, useSearchParams} from 'next/navigation';
import {Button} from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {useToast} from '@/hooks/use-toast';
import { LogIn} from 'lucide-react';
import {useAuth} from '@/components/auth-provider';
import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert';
import { Loader } from '@/components/ui/loader';
import { RalsonTyreIcon } from '@/components/icons/ralson-tyre-icon';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const {login} = useAuth();
  const {toast} = useToast();

  const handleLogin = async () => {
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    
    if (result.success) {
      toast({
        title: 'Login Successful',
        description: 'Welcome back!',
      });
      router.push('/');
    } else {
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: result.message || 'Invalid email or password.',
      });
    }
  };

  const signedUpEmail = searchParams.get('signed_up');

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        {signedUpEmail && (
          <Alert>
            <AlertTitle>Registration Successful!</AlertTitle>
            <AlertDescription>
              Thank you for signing up. Your account is pending approval by an administrator. You will be able to log in once your account has been approved.
            </AlertDescription>
          </Alert>
        )}
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center items-center gap-2 mb-4">
              <RalsonTyreIcon className="w-10 h-10 text-primary" />
              <h1 className="text-2xl font-semibold">TyreTrack Pro</h1>
            </div>
            <CardTitle>Login</CardTitle>
            <CardDescription>Enter your credentials to continue</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Enter your email"
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              />
            </div>
          </CardContent>
          <CardFooter className="flex-col gap-4">
            <Button className="w-full" onClick={handleLogin} disabled={loading}>
              {loading ? <Loader className="mr-2 h-4 w-4" /> : <LogIn className="mr-2 h-4 w-4" />}
              Login
            </Button>
            <p className="text-sm text-muted-foreground">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="font-medium text-primary hover:underline">
                Sign up
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
