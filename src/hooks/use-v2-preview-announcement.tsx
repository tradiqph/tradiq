"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  hasV2PreviewBeenShownThisSession,
  isV2PreviewCampaignActive,
  markV2PreviewShownThisSession,
} from "@/lib/announcements/v2-preview-campaign";

interface V2PreviewAnnouncementContextValue {
  open: boolean;
  isCampaignActive: boolean;
  openAnnouncement: () => void;
  closeAnnouncement: () => void;
  setOpen: (open: boolean) => void;
}

const V2PreviewAnnouncementContext =
  createContext<V2PreviewAnnouncementContextValue | null>(null);

const AUTO_OPEN_DELAY_MS = 400;

export function V2PreviewAnnouncementProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [isCampaignActive, setIsCampaignActive] = useState(false);

  useEffect(() => {
    setIsCampaignActive(isV2PreviewCampaignActive());
  }, []);

  const openAnnouncement = useCallback(() => {
    if (!isV2PreviewCampaignActive()) return;
    setOpen(true);
  }, []);

  const closeAnnouncement = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    if (loading || !user || !isCampaignActive) return;
    if (hasV2PreviewBeenShownThisSession()) return;

    const timer = window.setTimeout(() => {
      if (!isV2PreviewCampaignActive()) return;
      setOpen(true);
      markV2PreviewShownThisSession();
    }, AUTO_OPEN_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [loading, user, isCampaignActive]);

  const value = useMemo(
    () => ({
      open,
      isCampaignActive,
      openAnnouncement,
      closeAnnouncement,
      setOpen,
    }),
    [open, isCampaignActive, openAnnouncement, closeAnnouncement]
  );

  return (
    <V2PreviewAnnouncementContext.Provider value={value}>
      {children}
    </V2PreviewAnnouncementContext.Provider>
  );
}

export function useV2PreviewAnnouncement() {
  const ctx = useContext(V2PreviewAnnouncementContext);
  if (!ctx) {
    throw new Error(
      "useV2PreviewAnnouncement must be used within V2PreviewAnnouncementProvider"
    );
  }
  return ctx;
}

export function useV2PreviewAnnouncementOptional() {
  return useContext(V2PreviewAnnouncementContext);
}
