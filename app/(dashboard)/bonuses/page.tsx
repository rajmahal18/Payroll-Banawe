import { redirect } from "next/navigation";

export default async function BonusesPage() {
  redirect("/advances?tab=bonuses");
}
