"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function StudentIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/student/dashboard");
  }, [router]);
  return null;
}
