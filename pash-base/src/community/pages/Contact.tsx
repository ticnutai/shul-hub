import { useState } from "react";
import { toast } from "sonner";
import { CommunityHeader } from "@community/components/CommunityChrome";
import { CommunityFooter } from "@community/components/CommunityChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@community/integrations/supabase/client";

export function ContactPage() {
  const [form, setForm] = useState({ sender_name: "", phone: "", subject: "", body: "" });
  const [sending, setSending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.body.trim()) {
      toast.error("נא לכתוב את תוכן ההודעה");
      return;
    }
    setSending(true);
    const { error } = await supabase.from("admin_messages").insert(form);
    setSending(false);
    if (error) {
      toast.error("שליחת ההודעה נכשלה, נסו שוב");
      return;
    }
    toast.success("ההודעה נשלחה לגבאי");
    setForm({ sender_name: "", phone: "", subject: "", body: "" });
  }

  return (
    <div className="min-h-screen">
      <CommunityHeader />
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-3xl font-bold">הודעה לגבאי</h1>
        <p className="mt-2 text-muted-foreground">
          בקשה, מודעת מזל טוב, הערה או שאלה — נשמח לשמוע.
        </p>

        <form onSubmit={submit} className="card-elev mt-6 space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">שם</Label>
              <Input
                id="name"
                value={form.sender_name}
                onChange={(e) => setForm({ ...form, sender_name: e.target.value })}
                placeholder="שם מלא"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">טלפון</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="05X-0000000"
                inputMode="tel"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="subject">נושא</Label>
            <Input
              id="subject"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="לדוגמה: בקשה לקידוש בשבת"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="body">תוכן ההודעה</Label>
            <Textarea
              id="body"
              rows={6}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="כתבו כאן…"
            />
          </div>
          <Button type="submit" disabled={sending} className="w-full">
            {sending ? "שולח…" : "שליחת הודעה"}
          </Button>
        </form>
      </main>
      <CommunityFooter />
    </div>
  );
}
