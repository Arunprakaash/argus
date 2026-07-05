import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function requireDashboardUser() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function unauthorizedResponse() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
