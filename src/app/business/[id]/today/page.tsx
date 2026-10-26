import type { Metadata } from "next";
import { requireBusiness } from "@/lib/auth";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage(props: PageProps<"/business/[id]/today">) {
  const { id } = await props.params;
  const { business } = await requireBusiness(id);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Today</h1>
      <Card>
        <CardTitle>Nothing due today</CardTitle>
        <CardDescription>Your plan for {business.name || "your business"} will show up here.</CardDescription>
      </Card>
    </div>
  );
}
