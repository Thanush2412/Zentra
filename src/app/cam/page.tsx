"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RedirectingLoader } from "@/components/RedirectingLoader";

export default function camIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/cam/overview");
  }, [router]);
  return <RedirectingLoader label="Loading CM Dashboard…" />;
}
