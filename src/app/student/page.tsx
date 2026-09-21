"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RedirectingLoader } from "@/components/RedirectingLoader";

export default function studentIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/student/dashboard");
  }, [router]);
  return <RedirectingLoader label="Loading Student Portal…" />;
}
