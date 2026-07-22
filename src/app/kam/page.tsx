"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function KAMIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/kam/overview");
  }, [router]);
  return null;
}
