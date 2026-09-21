"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RedirectingLoader } from "@/components/RedirectingLoader";

export default function adminIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/overview");
  }, [router]);
  return <RedirectingLoader label="Loading Admin Central…" />;
}
