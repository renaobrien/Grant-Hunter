"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { GRANT_STATUSES, type GrantStatus } from "@/lib/types";

export async function updateGrantStatus(id: string, status: string) {
  if (!GRANT_STATUSES.includes(status as GrantStatus)) {
    throw new Error(`Invalid grant status: ${status}`);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("grants")
    .update({ status })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to update grant status: ${error.message}`);
  }

  revalidatePath("/");
}
