"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RedirectingLoader } from "@/components/RedirectingLoader";

export default function cmIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/cm/overview");
  }, [router]);
  return <RedirectingLoader label="Loading CM Dashboard…" />;
}
