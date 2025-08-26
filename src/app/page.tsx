'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
// Note: All UI components and the useSponsorProfile hook have been removed for this test.

export default function BarebonesLoginPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('sponsor');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Minimal setup on component mount
  useEffect(() => {
    localStorage.removeItem('current_user_profile');
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault(); // Prevent the default form submission (page reload)
    setError('');
    
    if (!email) {
      setError('Email is required');
      return;
    }
    
    if (!password) {
      setError('Password is required');
      return;
    }
    
    alert(`Attempting to sign in as ${email} with role ${activeTab}. If you see this alert, the JavaScript is working.`);

    // Simplified login logic for testing
    const usersRaw = localStorage.getItem('users');
    const users = usersRaw ? JSON.parse(usersRaw) : [];
    const existingUser = users.find((user: any) => user.email.toLowerCase() === email.toLowerCase());

    if (!existingUser) {
        setError('This email is not registered.');
        return;
    }
    if (existingUser.role !== activeTab) {
        setError(`This email is registered as a ${existingUser.role}. Please use the correct tab.`);
        return;
    }
    
    // On success, redirect
    router.push('/dashboard');
  };

  const handleTabClick = (tab: string) => {
    setActiveTab(tab);
    setEmail('');
    setPassword('');
    setError('');
  };

  // Basic inline styles to keep the layout usable for the test
  const formStyle = {
    maxWidth: '400px',
    margin: '50px auto',
    padding: '20px',
    border: '1px solid #ccc',
    borderRadius: '8px',
  };
  const inputStyle = { width: '100%', padding: '8px', margin: '5px 0 15px 0' };
  const buttonStyle = { width: '100%', padding: '10px' };

  return (
    <div style={formStyle}>
      <h1 style={{ textAlign: 'center' }}>Barebones Login Test</h1>
      
      <div style={{ display: 'flex', marginBottom: '20px', gap: '5px' }}>
        <button type="button" onClick={() => handleTabClick('sponsor')} style={{ flex: 1, backgroundColor: activeTab === 'sponsor' ? '#ddd' : '#fff' }}>
          Sponsor
        </button>
        <button type="button" onClick={() => handleTabClick('individual')} style={{ flex: 1, backgroundColor: activeTab === 'individual' ? '#ddd' : '#fff' }}>
          Individual
        </button>
        <button type="button" onClick={() => handleTabClick('organizer')} style={{ flex: 1, backgroundColor: activeTab === 'organizer' ? '#ddd' : '#fff' }}>
          Organizer
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email">Email</label>
          <input 
            id="email" 
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
            required 
          />
        </div>
        <div>
          <label htmlFor="password">Password</label>
          <input 
            id="password" 
            type="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
            required 
          />
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" style={buttonStyle}>
          Sign In
        </button>
      </form>
    </div>
  );
}
