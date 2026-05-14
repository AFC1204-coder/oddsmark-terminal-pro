import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Send, Check, AlertCircle, Unplug, Zap } from "lucide-react";

interface TelegramStatus {
  connected: boolean;
  channelName: string | null;
  botUsername: string | null;
  autoPublish: boolean;
  publishPending: boolean;
  publishResults: boolean;
}

export function TelegramConfig() {
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [channelName, setChannelName] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "connected" | "error">("idle");
  const [botUsername, setBotUsername] = useState<string | null>(null);
  const [autoPublish, setAutoPublish] = useState(false);
  const [publishPending, setPublishPending] = useState(true);
  const [publishResults, setPublishResults] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  const { data: telegramStatus } = useQuery<TelegramStatus>({
    queryKey: ["/api/telegram/status"],
    retry: false,
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/telegram/config", {
        botToken,
        chatId,
        channelName,
        autoPublish,
        publishPending,
        publishResults,
      });
      return await res.json() as { success: boolean; botUsername?: string };
    },
    onSuccess: (data) => {
      if (data.success) {
        setStatus("connected");
        setBotUsername(data.botUsername || null);
        setBotToken("");
        queryClient.invalidateQueries({ queryKey: ["/api/telegram/status"] });
        return;
      }
      setStatus("error");
    },
    onError: () => setStatus("error"),
  });

  const updateConfigMutation = useMutation({
    mutationFn: ({ field, value }: { field: "autoPublish" | "publishPending" | "publishResults"; value: boolean }) =>
      apiRequest("PATCH", "/api/telegram/config", { [field]: value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telegram/status"] });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/telegram/config", undefined, {
      headers: { "X-Confirm-Action": "disconnect-telegram" },
    }),
    onSuccess: () => {
      setStatus("idle");
      setBotUsername(null);
      setChannelName("");
      setAutoPublish(false);
      queryClient.invalidateQueries({ queryKey: ["/api/telegram/status"] });
    },
  });

  useEffect(() => {
    if (!telegramStatus) return;
    if (telegramStatus.connected) {
      setStatus("connected");
      setBotUsername(telegramStatus.botUsername);
      setChannelName(telegramStatus.channelName || "");
      setAutoPublish(telegramStatus.autoPublish);
      setPublishPending(telegramStatus.publishPending);
      setPublishResults(telegramStatus.publishResults);
    }
  }, [telegramStatus]);

  const handleConnect = async () => {
    if (!botToken || !chatId) return;
    setStatus("loading");
    connectMutation.mutate();
  };

  const handleToggle = async (field: "autoPublish" | "publishPending" | "publishResults", value: boolean) => {
    const prev = { autoPublish, publishPending, publishResults };
    // Optimistic update
    if (field === "autoPublish") setAutoPublish(value);
    if (field === "publishPending") setPublishPending(value);
    if (field === "publishResults") setPublishResults(value);

    updateConfigMutation.mutate({ field, value }, {
      onError: () => {
      // Revert on failure
        if (field === "autoPublish") setAutoPublish(prev.autoPublish);
        if (field === "publishPending") setPublishPending(prev.publishPending);
        if (field === "publishResults") setPublishResults(prev.publishResults);
      },
    });
  };

  const handleDisconnect = async () => {
    const confirmed = window.confirm(
      "¿Desconectar Telegram?\n\nSe eliminará la conexión del bot y dejará de publicar apuestas o resultados automáticamente.",
    );
    if (!confirmed) return;
    setDisconnecting(true);
    disconnectMutation.mutate(undefined, {
      onSettled: () => setDisconnecting(false),
    });
  };

  if (status === "connected") {
    return (
      <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Send className="w-4 h-4 text-sky-400" />
          <span className="text-xs font-bold text-sky-400">Telegram Conectado</span>
          <Check className="w-3.5 h-3.5 text-emerald-400 ml-auto" />
        </div>
        <p className="text-[10px] text-zinc-400">
          Bot: <span className="text-zinc-300 font-mono">@{botUsername}</span>
          {channelName && <> · Canal: <span className="text-zinc-300">{channelName}</span></>}
        </p>

        {/* Auto-publish controls */}
        <div className="space-y-2 pt-1 border-t border-sky-500/10">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] font-bold text-zinc-300">Auto-publicar en tu canal</span>
          </div>

          <ToggleRow
            label="Publicar automáticamente"
            description="Publica apuestas y resultados sin pulsar nada"
            checked={autoPublish}
            onChange={(v) => handleToggle("autoPublish", v)}
          />

          {autoPublish && (
            <>
              <ToggleRow
                label="Nuevas apuestas"
                description="Publica cuando creas una apuesta"
                checked={publishPending}
                onChange={(v) => handleToggle("publishPending", v)}
              />
              <ToggleRow
                label="Resultados"
                description="Publica cuando una apuesta se resuelve"
                checked={publishResults}
                onChange={(v) => handleToggle("publishResults", v)}
              />
            </>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleDisconnect}
          disabled={disconnecting}
          className="w-full text-zinc-500 hover:text-red-400 text-[10px] h-7"
        >
          <Unplug className="w-3 h-3 mr-1" />
          {disconnecting ? "Desconectando..." : "Desconectar"}
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Send className="w-4 h-4 text-sky-400" />
        <span className="text-xs font-bold text-zinc-300">Conectar Telegram</span>
      </div>

      <p className="text-[10px] text-zinc-500 leading-relaxed">
        Conecta tu bot de Telegram para publicar apuestas verificadas automáticamente en tu canal.
      </p>

      <div className="space-y-2">
        <div>
          <label className="text-[9px] uppercase tracking-wider text-zinc-500 mb-1 block">1. Crea un bot con @BotFather</label>
          <Input
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            placeholder="Token del bot (ej: 123456:ABC-DEF...)"
            className="bg-zinc-800 border-zinc-700 text-zinc-200 h-8 text-xs font-mono"
            type="password"
          />
        </div>
        <div>
          <label className="text-[9px] uppercase tracking-wider text-zinc-500 mb-1 block">2. Chat ID del canal/grupo</label>
          <Input
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            placeholder="Chat ID (ej: -1001234567890)"
            className="bg-zinc-800 border-zinc-700 text-zinc-200 h-8 text-xs font-mono"
          />
        </div>
        <div>
          <label className="text-[9px] uppercase tracking-wider text-zinc-500 mb-1 block">3. Nombre del canal (opcional)</label>
          <Input
            value={channelName}
            onChange={(e) => setChannelName(e.target.value)}
            placeholder="@mi_canal_tips"
            className="bg-zinc-800 border-zinc-700 text-zinc-200 h-8 text-xs"
          />
        </div>
      </div>

      {/* Auto-publish opt-in during setup */}
      <ToggleRow
        label="Auto-publicar apuestas"
        description="Publica automáticamente en tu canal al crear apuestas"
        checked={autoPublish}
        onChange={setAutoPublish}
      />

      {status === "error" && (
        <div className="flex items-center gap-1.5 text-red-400 text-[10px]">
          <AlertCircle className="w-3 h-3" />
          Token invalido o sin permisos
        </div>
      )}

      <Button
        onClick={handleConnect}
        disabled={!botToken || !chatId || status === "loading"}
        size="sm"
        className="w-full bg-sky-600 hover:bg-sky-700 text-white text-xs h-8"
      >
        {status === "loading" ? "Conectando..." : "Conectar Bot"}
      </Button>

      <p className="text-[9px] text-zinc-600 leading-relaxed">
        Añade el bot como admin a tu canal. Las apuestas se publican con link de verificación.
      </p>
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer group">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`mt-0.5 w-8 h-[18px] rounded-full transition-colors flex-shrink-0 relative ${
          checked ? "bg-emerald-600" : "bg-zinc-700"
        }`}
      >
        <span className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform ${
          checked ? "left-[16px]" : "left-[2px]"
        }`} />
      </button>
      <div>
        <span className="text-[11px] font-medium text-zinc-300 group-hover:text-white transition-colors">{label}</span>
        <p className="text-[9px] text-zinc-500 leading-tight">{description}</p>
      </div>
    </label>
  );
}
