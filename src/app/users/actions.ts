
'use server';

import { auth, db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import type { SponsorProfile } from '@/hooks/use-sponsor-profile';

// Standalone function for organizer to create users - NO RECURSION POSSIBLE
export async function createUserByOrganizer(
  email: string, 
  password: string, 
  profileData: Partial<SponsorProfile>
): Promise<{ success: true; user: any; profile: SponsorProfile }> {
  
  console.log('🔑 Organizer creating user:', email);
  
  if (!auth || !db) {
    throw new Error('Firebase services not available.');
  }
  
  const normalizedEmail = email.trim().toLowerCase();
  const trimmedPassword = password.trim();
  
  // Basic validation
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    throw new Error('Please enter a valid email address.');
  }
  
  if (trimmedPassword.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }
  
  try {
    // Step 1: Create the Firebase Auth user directly
    console.log('Creating Firebase Auth user...');
    const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, trimmedPassword);
    const newUser = userCredential.user;
    console.log('✅ Auth user created with UID:', newUser.uid);
    
    // Step 2: Create the profile directly - NO COMPLEX LOGIC
    const now = new Date().toISOString();
    const profile: SponsorProfile = {
      uid: newUser.uid,
      email: normalizedEmail,
      firstName: profileData.firstName || 'New',
      lastName: profileData.lastName || 'User',
      role: profileData.role || 'individual',
      district: profileData.district || 'None',
      school: profileData.school || 'Homeschool',
      phone: profileData.phone || '',
      isDistrictCoordinator: profileData.isDistrictCoordinator || false,
      avatarType: profileData.avatarType || 'icon',
      avatarValue: profileData.avatarValue || 'PawnIcon',
      forceProfileUpdate: true, // New users created by organizer should complete their profile
      createdAt: now,
      updatedAt: now,
    };
    
    // Step 3: Save to Firestore directly
    console.log('Saving user profile...');
    await setDoc(doc(db, 'users', newUser.uid), profile);
    console.log('✅ User profile saved successfully');
    
    // Step 4: Return success
    console.log('✅ Organizer user creation completed for:', normalizedEmail);
    return {
      success: true,
      user: newUser,
      profile
    };
    
  } catch (error: any) {
    console.error('❌ Organizer user creation failed:', error);
    
    // Handle specific errors
    if (error.code === 'auth/email-already-in-use') {
      throw new Error(`A user with email ${normalizedEmail} already exists.`);
    } else if (error.code === 'auth/weak-password') {
      throw new Error('Password is too weak. Please use at least 6 characters.');
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('Please enter a valid email address.');
    } else if (error.code === 'auth/network-request-failed') {
      throw new Error('Network error. Please check your connection and try again.');
    } else {
      throw new Error(error.message || 'Failed to create user account.');
    }
  }
}

// BATCH USER CREATION - If organizer needs to create multiple users
export async function createMultipleUsersByOrganizer(
  users: Array<{
    email: string;
    password: string;
    profileData: Partial<SponsorProfile>;
  }>
): Promise<Array<{ success: boolean; email: string; user?: any; profile?: SponsorProfile; error?: string }>> {
  
  console.log(`🔑 Organizer creating ${users.length} users...`);
  const results = [];
  
  for (const userData of users) {
    try {
      const result = await createUserByOrganizer(userData.email, userData.password, userData.profileData);
      results.push({
        success: true,
        email: userData.email,
        user: result.user,
        profile: result.profile
      });
      
      // Add small delay between creations to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error: any) {
      console.error(`Failed to create user ${userData.email}:`, error.message);
      results.push({
        success: false,
        email: userData.email,
        error: error.message
      });
    }
  }
  
  console.log(`✅ Batch creation completed: ${results.filter(r => r.success).length}/${users.length} successful`);
  return results;
}

// DEBUGGING - Test the organizer creation function
export async function testOrganizerCreation() {
  try {
    console.log('Testing organizer user creation...');
    
    const testEmail = 'test-organizer-' + Date.now() + '@example.com';
    const result = await createUserByOrganizer(testEmail, 'testpassword123', {
      firstName: 'Test',
      lastName: 'OrganizerCreated',
      role: 'sponsor',
      district: 'Test District',
      school: 'Test School',
      phone: '555-0123',
      isDistrictCoordinator: false,
      avatarType: 'icon',
      avatarValue: 'PawnIcon',
    });
    
    console.log('✅ Organizer creation test successful:', result.profile);
    return result;
    
  } catch (error) {
    console.error('❌ Organizer creation test failed:', error);
    throw error;
  }
}
