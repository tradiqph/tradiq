"use client";

import { V2PreviewAnnouncementModal } from "@/components/announcements/v2-preview-announcement-modal";
import {
  useV2PreviewAnnouncement,
  V2PreviewAnnouncementProvider,
} from "@/hooks/use-v2-preview-announcement";

function V2PreviewAnnouncementModalHost() {
  const { open, setOpen } = useV2PreviewAnnouncement();
  return (
    <V2PreviewAnnouncementModal open={open} onOpenChange={setOpen} />
  );
}

export function V2PreviewAnnouncementHost({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <V2PreviewAnnouncementProvider>
      {children}
      <V2PreviewAnnouncementModalHost />
    </V2PreviewAnnouncementProvider>
  );
}
