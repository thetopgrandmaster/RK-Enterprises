/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { LogIn, LogOut, LayoutDashboard, Users, IndianRupee, Warehouse, FileText, Calendar, ShoppingBag } from 'lucide-react';

// Components (to be implemented)
import Dashboard from './components/Dashboard';
import Parties from './components/Parties';
import Payments from './components/Payments';
import GodownStock from './components/GodownStock';
import LoadSheet from './components/LoadSheet';
import DailyTracker from './components/DailyTracker';
import PurchaseStock from './components/PurchaseStock';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast.success('Logged in successfully');
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Failed to login');
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
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold tracking-tight">AluTrade Manager</CardTitle>
            <CardDescription>Middleman Aluminum Trading System</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-6">
            <div className="p-4 bg-primary/10 rounded-full">
              <Warehouse className="w-12 h-12 text-primary" />
            </div>
            <p className="text-center text-muted-foreground">
              Please sign in with your Google account to manage your trading business.
            </p>
            <Button onClick={handleLogin} className="w-full flex items-center gap-2">
              <LogIn className="w-4 h-4" />
              Sign in with Google
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isAdmin = user?.email === 'bprateep74@gmail.com';

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      {!isAdmin && (
        <div className="bg-amber-500 text-white text-center py-2 text-sm font-medium">
          Warning: You are logged in as {user?.email}, but only bprateep74@gmail.com has admin permissions.
        </div>
      )}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Warehouse className="w-6 h-6 text-primary" />
            <span className="font-bold text-xl tracking-tight">AluTrade</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium">{user.displayName}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
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
              <TabsTrigger value="purchase-stock" className="flex items-center gap-2 px-4">
                <ShoppingBag className="w-4 h-4" />
                <span className="hidden sm:inline">Purchase Stock</span>
              </TabsTrigger>
              <TabsTrigger value="daily" className="flex items-center gap-2 px-4">
                <Calendar className="w-4 h-4" />
                <span className="hidden sm:inline">Daily</span>
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
          <TabsContent value="purchase-stock" className="mt-0">
            <PurchaseStock />
          </TabsContent>
          <TabsContent value="daily" className="mt-0">
            <DailyTracker />
          </TabsContent>
        </Tabs>
      </main>
      <Toaster position="top-right" />
    </div>
  );
}
