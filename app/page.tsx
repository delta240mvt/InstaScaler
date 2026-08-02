import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function Home() {
  if ((await cookies()).has("__Host-instascaler-session")) {
    redirect("/dashboard");
  }
  redirect("/login");
}
