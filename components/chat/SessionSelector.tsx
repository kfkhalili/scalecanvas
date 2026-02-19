"use client";

import { useRouter } from "next/navigation";
import { useSessionStore } from "@/stores/sessionStore";
import { createSessionApi, fetchSessions } from "@/services/sessionsClient";
import { Button } from "@/components/ui/button";
import { useEffect, useCallback } from "react";

export function SessionSelector(): React.ReactElement {
  const router = useRouter();
  const { currentSessionId, sessions, setCurrentSessionId, setSessions } =
    useSessionStore();

  const loadSessions = useCallback(() => {
    fetchSessions().then((result) => {
      result.match(
        (list) => setSessions(list),
        () => setSessions([])
      );
    });
  }, [setSessions]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleNewSession = (): void => {
    createSessionApi(null).then((result) => {
      result.match(
        (session) => {
          setCurrentSessionId(session.id);
          router.push(`/interview/${session.id}`);
          fetchSessions().then((r) =>
            r.match((list) => setSessions(list), () => {})
          );
        },
        () => {}
      );
    });
  };

  const handleSelect = (sessionId: string): void => {
    setCurrentSessionId(sessionId);
    router.push(`/interview/${sessionId}`);
  };

  return (
    <div className="flex flex-col gap-2 p-2">
      <Button onClick={handleNewSession} variant="default" className="w-full">
        New session
      </Button>
      <select
        value={currentSessionId ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          if (v) handleSelect(v);
        }}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring [color-scheme:dark]"
      >
        <option value="">Select session</option>
        {sessions.map((s) => (
          <option key={s.id} value={s.id}>
            {s.title ?? "Untitled"} ({new Date(s.createdAt).toLocaleDateString()})
          </option>
        ))}
      </select>
    </div>
  );
}
