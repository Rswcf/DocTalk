"use client";

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import type { UserProfile } from '../types';
import { getUserProfile } from './api';

interface UseUserPlanProfileResult {
  profile: UserProfile | null;
  isLoggedIn: boolean;
  userPlan: UserProfile['plan'] | undefined;
  canUseCustomInstructions: boolean;
}

export function useUserPlanProfile(): UseUserPlanProfileResult {
  const { status } = useSession();
  const isLoggedIn = status === 'authenticated';
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!isLoggedIn) {
      setProfile(null);
      return;
    }

    getUserProfile()
      .then(setProfile)
      .catch((e) => console.error('Failed to load profile:', e));
  }, [isLoggedIn]);

  return {
    profile,
    isLoggedIn,
    // Do not guess Free while an authenticated profile is still loading:
    // billing actions need the server-authoritative plan to avoid offering a
    // second subscription to an existing Plus/Pro customer.
    userPlan: profile?.plan,
    canUseCustomInstructions: profile?.plan === 'pro',
  };
}
