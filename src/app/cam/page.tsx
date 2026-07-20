"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CAMIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/cam/overview");
  }, [router]);
  return null;
}
