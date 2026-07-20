"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MentorIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/mentor/home");
  }, [router]);
  return null;
}
