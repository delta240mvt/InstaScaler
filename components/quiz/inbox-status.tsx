"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { quizApi } from "./fields";
import { runStatusLabels } from "./contacts-list";

export function QuizInboxStatus({ accountId, userId, refresh }: { accountId: string; userId: string; refresh: boolean }) {
  const [state, setState] = useState<{ contactId: string; status: string } | null>(null);
  useEffect(() => {
    let live = true;
    quizApi.quizContacts.list({ instagramAccountId: accountId, instagramUserId: userId, pageSize: 1 }).then(async r => {
      const contact = r.data.items[0];
      if (!contact) { if (live) setState(null); return; }
      const runs = await quizApi.quizContacts.runs(contact.id, { pageSize: 1 });
      if (live) setState({ contactId: contact.id, status: runs.data.items[0]?.status ?? "COMPLETED" });
    }).catch(() => { if (live) setState(null); });
    return () => { live = false; };
  }, [accountId, userId, refresh]);
  if (!state) return null;
  return <div className="border-b border-border bg-accent-soft px-4 py-3 text-xs leading-relaxed"><p>Quiz: {runStatusLabels[state.status] ?? state.status}. Ręczna odpowiedź wstrzymuje aktywny quiz.</p><Link className="mt-1 inline-block font-semibold underline" href={`/paths/contacts/${state.contactId}`}>Profil kontaktu i sterowanie quizem →</Link></div>;
}
