import { Badge } from "@/components/ui/badge";
import type { Post, SafetyStatus } from "@/lib/types";

export const PLATFORM_LABEL: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  google_business: "Google",
  whatsapp_status: "WhatsApp status",
};

export function PlatformBadge({ platform }: { platform: string }) {
  return <Badge variant="outline">{PLATFORM_LABEL[platform] ?? platform}</Badge>;
}

export function SafetyBadge({ status }: { status: SafetyStatus }) {
  if (status === "pass") return <Badge variant="success">Safety: pass</Badge>;
  if (status === "pass_with_changes") return <Badge variant="warning">Safety: check</Badge>;
  return <Badge variant="danger">Safety: fix needed</Badge>;
}

export function StatusBadge({ status }: { status: Post["status"] }) {
  const map = { draft: "secondary", ready: "default", posted: "success", skipped: "outline" } as const;
  const label = { draft: "Draft", ready: "Ready", posted: "Posted", skipped: "Skipped" }[status];
  return <Badge variant={map[status]}>{label}</Badge>;
}
