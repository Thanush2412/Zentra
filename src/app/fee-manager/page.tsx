"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RedirectingLoader } from "@/components/RedirectingLoader";

export default function FeeManagerIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/fee-manager/overview");
  }, [router]);
  return <RedirectingLoader label="Loading Fee Manager…" />;
}
