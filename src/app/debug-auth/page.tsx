// src/app/debug-auth/page.tsx - Debug authentication page
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { debugFirebaseConfig, debugSignUp, debugSignIn } from '@/lib/auth-debug';

export default function DebugAuthPage() {
  const [email, setEmail] = useState('test@example.com');
  const [password, setPassword] = useState('testpassword123');
  const [results, setResults] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const logResult = (message: string) => {
    setResults(prev => prev + '\n' + message);
    console.log(message);
  };

  const handleDebugConfig = () => {
    logResult('=== Checking Firebase Configuration ===');
    const status = debugFirebaseConfig();
    logResult(`Auth Ready: ${status.authReady}`);
    logResult(`DB Ready: ${status.dbReady}`);
    logResult(`Config Complete: ${status.configComplete}`);
  };

  const handleTestSignUp = async () => {
    setLoading(true);
    logResult(`=== Testing Sign Up for ${email} ===`);
    
    try {
      const result = await debugSignUp(email, password);
      if (result.success) {
        logResult(`✅ Sign up successful! UID: ${result.uid}`);
      } else {
        logResult(`❌ Sign up failed: ${result.error}`);
        logResult(`Error code: ${result.code}`);
      }
    } catch (error) {
      logResult(`❌ Unexpected error: ${error}`);
    }
    
    setLoading(false);
  };

  const handleTestSignIn = async () => {
    setLoading(true);
    logResult(`=== Testing Sign In for ${email} ===`);
    
    try {
      const result = await debugSignIn(email, password);
      if (result.success) {
        logResult(`✅ Sign in successful! UID: ${result.uid}`);
        logResult(`Profile: ${JSON.stringify(result.profile, null, 2)}`);
      } else {
        logResult(`❌ Sign in failed: ${result.error}`);
        logResult(`Error code: ${result.code}`);
      }
    } catch (error) {
      logResult(`❌ Unexpected error: ${error}`);
    }
    
    setLoading(false);
  };

  const clearResults = () => {
    setResults('');
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Firebase Authentication Debug Tool</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="test@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="password123"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleDebugConfig} variant="outline">
              Check Firebase Config
            </Button>
            <Button 
              onClick={handleTestSignUp} 
              disabled={loading}
              className="bg-green-600 hover:bg-green-700"
            >
              {loading ? 'Testing...' : 'Test Sign Up'}
            </Button>
            <Button 
              onClick={handleTestSignIn} 
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? 'Testing...' : 'Test Sign In'}
            </Button>
            <Button onClick={clearResults} variant="destructive">
              Clear Results
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Debug Results</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-gray-100 p-4 rounded-md text-sm overflow-auto max-h-96 whitespace-pre-wrap">
            {results || 'No results yet. Click a button above to start testing.'}
          </pre>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Environment Check</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm space-y-2">
            <div>API Key: {process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? '✅ Set' : '❌ Missing'}</div>
            <div>Auth Domain: {process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ? '✅ Set' : '❌ Missing'}</div>
            <div>Project ID: {process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? '✅ Set' : '❌ Missing'}</div>
            <div>Storage Bucket: {process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ? '✅ Set' : '❌ Missing'}</div>
            <div>Messaging Sender ID: {process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ? '✅ Set' : '❌ Missing'}</div>
            <div>App ID: {process.env.NEXT_PUBLIC_FIREBASE_APP_ID ? '✅ Set' : '❌ Missing'}</div>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Troubleshooting Steps</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <div className="font-medium">1. Check Environment Variables:</div>
          <div className="ml-4">Ensure all Firebase config variables are set in your .env.local file</div>
          
          <div className="font-medium">2. Verify Firebase Project:</div>
          <div className="ml-4">Make sure Authentication is enabled in the Firebase Console</div>
          
          <div className="font-medium">3. Check Network:</div>
          <div className="ml-4">Ensure your app can reach Firebase services</div>
          
          <div className="font-medium">4. Console Logs:</div>
          <div className="ml-4">Open browser dev tools to see detailed error messages</div>
        </CardContent>
      </Card>
    </div>
  );
}
