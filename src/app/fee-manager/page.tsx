"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function FeeManagerIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/fee-manager/overview");
  }, [router]);
  return null;
}
