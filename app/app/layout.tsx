import type { Metadata } from "next";

import { WorkspaceShell } from "@/components/app/workspace-shell";
import { requireVerifiedUser } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Лад — робочий простір",
};

export default async function PrivateAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Claims-only: middleware refreshed session; mutations still use getUser.
  await requireVerifiedUser();
  return <WorkspaceShell>{children}</WorkspaceShell>;
}
