import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFamily } from "@/hooks/use-family";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HabitReview } from "@/components/HabitReview";
import { HabitManage } from "@/components/HabitManage";

export function HabitsPage() {
  const { familyId, isParent } = useFamily();

  const kids = useQuery({
    queryKey: ["kids-basic", familyId],
    enabled: isParent,
    queryFn: async () => {
      const { data, error } = await supabase.from("rw_kids").select("id, name").eq("family_id", familyId).order("name");
      if (error) throw error;
      return data;
    },
  });

  if (!isParent) {
    return <Card className="p-6 text-center text-sm text-muted-foreground">Only parents can review and manage habits.</Card>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Habits</h1>
        <p className="text-sm text-muted-foreground">Review good habits and earn points.</p>
      </div>

      {kids.isPending ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : kids.isError ? (
        <Card className="p-4 text-sm text-destructive">Couldn't load kids: {kids.error.message}</Card>
      ) : (
        <Tabs defaultValue="review">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="review">Review</TabsTrigger>
            <TabsTrigger value="manage">Manage</TabsTrigger>
          </TabsList>
          <TabsContent value="review" className="mt-4">
            <HabitReview kids={kids.data} />
          </TabsContent>
          <TabsContent value="manage" className="mt-4">
            <HabitManage kids={kids.data} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
