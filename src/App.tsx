/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { auth } from './firebase';
import { 
  onAuthStateChanged, 
  signOut, 
  User, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider
} from 'firebase/auth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { LogIn, LogOut, LayoutDashboard, Users, IndianRupee, Warehouse, FileText, Calendar, ShoppingBag, UserPlus, RefreshCcw } from 'lucide-react';

// Components (to be implemented)
import Dashboard from './components/Dashboard';
import Parties from './components/Parties';
import Payments from './components/Payments';
import GodownStock from './components/GodownStock';
import LoadSheet from './components/LoadSheet';
import DailyTracker from './components/DailyTracker';
import SalesStock from './components/SalesStock';
import Reset from './components/Reset';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    
    if (!email || !password) {
      toast.error('Please enter both email and password');
      return;
    }

    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
        toast.success('Account created successfully');
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        toast.success('Logged in successfully');
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      let message = 'An error occurred during authentication';
      
      if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        message = 'Email or password is incorrect';
      } else if (error.code === 'auth/email-already-in-use') {
        message = 'User already exists. Please sign in';
      } else if (error.code === 'auth/weak-password') {
        message = 'Password should be at least 6 characters';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Invalid email address';
      }
      
      setAuthError(message);
      toast.error(message);
    }
  };

  const handleGoogleLogin = async () => {
    setAuthError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      toast.success('Logged in with Google successfully');
    } catch (error: any) {
      console.error('Google Auth error details:', error);
      let message = `Google Sign-In failed: ${error.message}`;
      
      if (error.code === 'auth/popup-closed-by-user') {
        message = 'Sign-in popup was closed before completion.';
      } else if (error.code === 'auth/unauthorized-domain') {
        const currentProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'unknown';
        message = `This domain (${window.location.hostname}) is not authorized in Firebase Console for project "${currentProjectId}". Please add it to "Authorized domains" in the Auth settings for THAT project.`;
      } else if (error.code === 'auth/operation-not-allowed') {
        message = 'Google Sign-In is not enabled in your Firebase Console.';
      }
      
      setAuthError(message);
      toast.error(message);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to logout');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50 p-4">
        <Card className="w-full max-w-md shadow-lg border-t-4 border-t-primary">
          <CardHeader className="text-center space-y-1">
            <div className="flex justify-center mb-2">
              <div className="p-3 bg-primary/10 rounded-full">
                <Warehouse className="w-8 h-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">RK Enterprises</CardTitle>
            <CardDescription>
              {isSignUp ? 'Create a new account' : 'Sign in to your account'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAuth} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="name@example.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input 
                  id="password" 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              
              {authError && (
                <p className="text-sm font-medium text-destructive text-center bg-destructive/10 p-2 rounded">
                  {authError}
                </p>
              )}
              
              <Button type="submit" className="w-full flex items-center gap-2">
                {isSignUp ? (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Sign Up
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    Sign In
                  </>
                )}
              </Button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-neutral-50 px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            <Button 
              variant="outline" 
              type="button" 
              className="w-full flex items-center gap-2"
              onClick={handleGoogleLogin}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google
            </Button>
          </CardContent>
          <CardFooter className="flex justify-center border-t p-4">
            <Button 
              variant="link" 
              onClick={() => {
                setIsSignUp(!isSignUp);
                setAuthError(null);
              }}
              className="text-sm text-muted-foreground"
            >
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Warehouse className="w-6 h-6 text-primary" />
            <span className="font-bold text-xl tracking-tight">RK Enterprises</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium">{user.email}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsList className="inline-flex w-auto sm:w-full justify-start sm:justify-center bg-white border shadow-sm h-12 p-1">
              <TabsTrigger value="dashboard" className="flex items-center gap-2 px-4">
                <LayoutDashboard className="w-4 h-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </TabsTrigger>
              <TabsTrigger value="parties" className="flex items-center gap-2 px-4">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Parties</span>
              </TabsTrigger>
              <TabsTrigger value="payments" className="flex items-center gap-2 px-4">
                <IndianRupee className="w-4 h-4" />
                <span className="hidden sm:inline">Payments</span>
              </TabsTrigger>
              <TabsTrigger value="godown" className="flex items-center gap-2 px-4">
                <Warehouse className="w-4 h-4" />
                <span className="hidden sm:inline">Godown</span>
              </TabsTrigger>
              <TabsTrigger value="load-sheet" className="flex items-center gap-2 px-4">
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">Load Sheet</span>
              </TabsTrigger>
              <TabsTrigger value="sales-stock" className="flex items-center gap-2 px-4">
                <ShoppingBag className="w-4 h-4" />
                <span className="hidden sm:inline">Sales Stock</span>
              </TabsTrigger>
              <TabsTrigger value="daily" className="flex items-center gap-2 px-4">
                <Calendar className="w-4 h-4" />
                <span className="hidden sm:inline">Daily</span>
              </TabsTrigger>
              <TabsTrigger value="reset" className="flex items-center gap-2 px-4">
                <RefreshCcw className="w-4 h-4" />
                <span className="hidden sm:inline">Reset</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="dashboard" className="mt-0">
            <Dashboard />
          </TabsContent>
          <TabsContent value="parties" className="mt-0">
            <Parties />
          </TabsContent>
          <TabsContent value="payments" className="mt-0">
            <Payments />
          </TabsContent>
          <TabsContent value="godown" className="mt-0">
            <GodownStock />
          </TabsContent>
          <TabsContent value="load-sheet" className="mt-0">
            <LoadSheet />
          </TabsContent>
          <TabsContent value="sales-stock" className="mt-0">
            <SalesStock />
          </TabsContent>
          <TabsContent value="daily" className="mt-0">
            <DailyTracker />
          </TabsContent>
          <TabsContent value="reset" className="mt-0">
            <Reset />
          </TabsContent>
        </Tabs>
      </main>
      <Toaster position="top-right" />
    </div>
  );
}
