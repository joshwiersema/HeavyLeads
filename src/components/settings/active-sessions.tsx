"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Monitor, Loader2 } from "lucide-react";

interface Session {
  token: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  createdAt: Date;
}

export function ActiveSessions({
  sessions,
  currentSessionToken,
}: {
  sessions: Session[];
  currentSessionToken: string;
}) {
  const [revokingToken, setRevokingToken] = useState<string | null>(null);
  const [revokedTokens, setRevokedTokens] = useState<Set<string>>(new Set());

  async function revokeSession(token: string) {
    setRevokingToken(token);
    try {
      const { error } = await authClient.revokeSession({ token });
      if (error) {
        toast.error("Failed to revoke session");
        return;
      }
      setRevokedTokens((prev) => new Set(prev).add(token));
      toast.success("Session revoked");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setRevokingToken(null);
    }
  }

  const activeSessions = sessions.filter((s) => !revokedTokens.has(s.token));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Sessions</CardTitle>
        <CardDescription>
          Devices and browsers currently signed in to your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activeSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active sessions</p>
          ) : (
            activeSessions.map((session) => {
              const isCurrent = session.token === currentSessionToken;
              return (
                <div
                  key={session.token}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div className="flex items-center gap-3">
                    <Monitor className="size-5 text-muted-foreground" />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">
                          {parseUserAgent(session.userAgent)}
                        </p>
                        {isCurrent && (
                          <Badge variant="secondary">Current</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {session.ipAddress || "Unknown IP"} &middot; Started{" "}
                        {new Date(session.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {!isCurrent && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => revokeSession(session.token)}
                      disabled={revokingToken === session.token}
                    >
                      {revokingToken === session.token ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        "Revoke"
                      )}
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function parseUserAgent(ua?: string | null): string {
  if (!ua) return "Unknown device";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari")) return "Safari";
  if (ua.includes("Edge")) return "Edge";
  return "Browser";
}
