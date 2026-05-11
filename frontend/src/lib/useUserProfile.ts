"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import type { UserProfile } from '../types';
import { getUserProfile } from './api';

const PROFILE_STALE_MS = 60_000;

let cachedProfile: UserProfile | null = null;
let cachedAt = 0;
let inflightRequest: Promise<UserProfile> | null = null;
let requestSeq = 0;

interface UseUserProfileResult {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<UserProfile | null>;
}

export function useUserProfile(): UseUserProfileResult {
  const { status } = useSession();
  const lastFetchedRef = useRef<number>(cachedAt);
  const [profile, setProfile] = useState<UserProfile | null>(cachedProfile);
  const [loading, setLoading] = useState<boolean>(status === 'authenticated' && !cachedProfile);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async (force = false): Promise<UserProfile | null> => {
    if (status !== 'authenticated') return null;

    const now = Date.now();
    const isFresh = now - lastFetchedRef.current < PROFILE_STALE_MS;

    if (!force && cachedProfile && isFresh) {
      setProfile(cachedProfile);
      setError(null);
      setLoading(false);
      return cachedProfile;
    }

    if (cachedProfile) {
      setProfile(cachedProfile);
    } else {
      setLoading(true);
    }
    setError(null);

    let request: Promise<UserProfile> | null = null;
    try {
      request = inflightRequest;
      let seq = requestSeq;
      if (force || !request) {
        request = getUserProfile();
        inflightRequest = request;
        seq = requestSeq + 1;
        requestSeq = seq;
      }
      const data = await request;
      if (seq === requestSeq) {
        cachedProfile = data;
        cachedAt = Date.now();
        lastFetchedRef.current = cachedAt;
        setProfile(data);
      }
      return data;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load profile';
      setError(message);
      return null;
    } finally {
      if (inflightRequest === request) {
        inflightRequest = null;
      }
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    if (status !== 'authenticated') {
      cachedProfile = null;
      cachedAt = 0;
      inflightRequest = null;
      requestSeq += 1;
      lastFetchedRef.current = 0;
      setProfile(null);
      setError(null);
      setLoading(false);
      return;
    }
    void fetchProfile();
  }, [status, fetchProfile]);

  const refetch = useCallback(() => fetchProfile(true), [fetchProfile]);

  return { profile, loading, error, refetch };
}
