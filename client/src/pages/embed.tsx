import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { ShieldCheck, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

interface EmbedStats {
  totalBets: number;
  settledBets: number;
  winRate: number;
  yield: number;
  profitUnits: number;
  avgOdds: number;
}

interface EmbedData {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isVerified: boolean;
  mainSport: string | null;
  followers: number;
  stats: EmbedStats;
  recentForm: string[];
}

export default function EmbedPage() {
  const [, params] = useRoute("/embed/:username");
  const username = params?.username;
  const {
    data,
    isLoading: loading,
    isError,
  } = useQuery<EmbedData | null>({
    queryKey: ["/api/tipsters", username, "embed"],
    enabled: !!username,
    retry: false,
    queryFn: async () => {
      const res = await fetch(`/api/tipsters/${encodeURIComponent(username || "")}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to load tipster");
      return await res.json();
    },
  });

  if (loading) {
    return (
      <EmbedShell>
        <div className="animate-pulse text-xs text-zinc-500">Cargando...</div>
      </EmbedShell>
    );
  }

  if (isError || !data) {
    return (
      <EmbedShell>
        <span className="text-xs text-zinc-500">Tipster no encontrado</span>
      </EmbedShell>
    );
  }

  const initials = data.displayName.slice(0, 2).toUpperCase();
  const isProfit = data.stats.profitUnits >= 0;
  const appUrl = `${window.location.origin}/tipster/${data.username}`;

  return (
    <div className="embed-container">
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: transparent; overflow: hidden; }
        .embed-container {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          background: #09090b;
          border: 1px solid #27272a;
          border-radius: 12px;
          padding: 16px;
          max-width: 380px;
          width: 100%;
          color: #fafafa;
        }
        .embed-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
        .embed-avatar {
          width: 40px; height: 40px; border-radius: 10px;
          background: #18181b; border: 1px solid #3f3f46;
          display: flex; align-items: center; justify-content: center;
          font-weight: 900; font-size: 14px; color: #a1a1aa;
          overflow: hidden; flex-shrink: 0;
        }
        .embed-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .embed-name { font-weight: 800; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .embed-username { font-size: 11px; color: #71717a; }
        .embed-verified { display: inline-flex; align-items: center; gap: 3px; font-size: 9px; font-weight: 700; color: #34d399; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.2); padding: 1px 6px; border-radius: 4px; margin-left: 6px; }
        .embed-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; }
        .embed-stat { background: #18181b; border: 1px solid #27272a; border-radius: 8px; padding: 8px; text-align: center; }
        .embed-stat-value { font-size: 16px; font-weight: 800; font-variant-numeric: tabular-nums; }
        .embed-stat-label { font-size: 9px; color: #71717a; margin-top: 2px; }
        .embed-green { color: #34d399; }
        .embed-red { color: #f87171; }
        .embed-form { display: flex; gap: 3px; margin-bottom: 12px; }
        .embed-form-dot { flex: 1; height: 6px; border-radius: 3px; }
        .embed-form-w { background: rgba(16,185,129,0.3); }
        .embed-form-l { background: rgba(248,113,113,0.3); }
        .embed-form-p { background: #27272a; }
        .embed-footer { display: flex; align-items: center; justify-content: space-between; }
        .embed-footer-text { font-size: 10px; color: #52525b; }
        .embed-footer a { font-size: 10px; color: #34d399; text-decoration: none; font-weight: 600; display: flex; align-items: center; gap: 3px; }
        .embed-footer a:hover { text-decoration: underline; }
      `}</style>

      {/* Header */}
      <div className="embed-header">
        <div className="embed-avatar">
          {data.avatarUrl ? (
            <img src={data.avatarUrl} alt="" />
          ) : (
            initials
          )}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <span className="embed-name">{data.displayName}</span>
            {data.isVerified && (
              <span className="embed-verified">
                <ShieldCheck style={{ width: 10, height: 10 }} />
                VERIFICADO
              </span>
            )}
          </div>
          <div className="embed-username">@{data.username}</div>
        </div>
      </div>

      {/* Stats */}
      <div className="embed-stats">
        <div className="embed-stat">
          <div className={`embed-stat-value ${isProfit ? "embed-green" : "embed-red"}`}>
            {isProfit ? "+" : ""}{data.stats.profitUnits.toFixed(1)}u
          </div>
          <div className="embed-stat-label">P&L</div>
        </div>
        <div className="embed-stat">
          <div className={`embed-stat-value ${data.stats.yield >= 0 ? "embed-green" : "embed-red"}`}>
            {data.stats.yield >= 0 ? "+" : ""}{data.stats.yield.toFixed(1)}%
          </div>
          <div className="embed-stat-label">Yield</div>
        </div>
        <div className="embed-stat">
          <div className={`embed-stat-value ${data.stats.winRate > 50 ? "embed-green" : ""}`} style={{ color: data.stats.winRate <= 50 ? "#fafafa" : undefined }}>
            {data.stats.winRate.toFixed(0)}%
          </div>
          <div className="embed-stat-label">Acierto</div>
        </div>
      </div>

      {/* Secondary row */}
      <div className="embed-stats" style={{ marginBottom: 10 }}>
        <div className="embed-stat">
          <div className="embed-stat-value" style={{ fontSize: 13, color: "#d4d4d8" }}>
            {data.stats.totalBets}
          </div>
          <div className="embed-stat-label">Apuestas</div>
        </div>
        <div className="embed-stat">
          <div className="embed-stat-value" style={{ fontSize: 13, color: "#d4d4d8" }}>
            @{data.stats.avgOdds.toFixed(2)}
          </div>
          <div className="embed-stat-label">Cuota media</div>
        </div>
        <div className="embed-stat">
          <div className="embed-stat-value" style={{ fontSize: 13, color: "#d4d4d8" }}>
            {data.followers}
          </div>
          <div className="embed-stat-label">Seguidores</div>
        </div>
      </div>

      {/* Recent Form */}
      {data.recentForm.length > 0 && (
        <div className="embed-form">
          {data.recentForm.slice(0, 10).map((r, i) => (
            <div
              key={i}
              className={`embed-form-dot ${r === "W" ? "embed-form-w" : r === "L" ? "embed-form-l" : "embed-form-p"}`}
            />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="embed-footer">
        <span className="embed-footer-text">Stats verificadas pre-evento</span>
        <a href={appUrl} target="_blank" rel="noopener noreferrer">
          Ver perfil <ExternalLink style={{ width: 10, height: 10 }} />
        </a>
      </div>
    </div>
  );
}

function EmbedShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#09090b] p-3">
      <div className="flex min-h-32 w-full max-w-[380px] items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-center">
        {children}
      </div>
    </div>
  );
}
