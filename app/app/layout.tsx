import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Лад — робочий простір",
};

export default function PrivateAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
