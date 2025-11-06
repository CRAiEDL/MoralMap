"use client";

import dynamic from "next/dynamic";

const AdminApp = dynamic(() => import("../../../src/admin/AdminApp"), {
  ssr: false,
});

export default function Page() {
  return <AdminApp />;
}
