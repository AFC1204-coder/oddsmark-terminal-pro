import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Camera, Save, Loader2, Link2 } from "lucide-react";

interface EditTipsterProfileModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (profile: TipsterProfileEdit) => void;
  currentProfile: {
    username: string;
    displayName: string;
    bio: string;
    avatarUrl: string | null;
    telegramUrl: string | null;
    twitterUrl: string | null;
    instagramUrl: string | null;
    youtubeUrl: string | null;
    isPublic: boolean;
  };
}

export interface TipsterProfileEdit {
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  telegramUrl: string | null;
  twitterUrl: string | null;
  instagramUrl: string | null;
  youtubeUrl: string | null;
  isPublic: boolean;
}

const MAX_AVATAR_BYTES = 250 * 1024;
const SOCIAL_FIELDS = [
  ["Telegram", "telegramUrl"],
  ["Twitter", "twitterUrl"],
  ["Instagram", "instagramUrl"],
  ["YouTube", "youtubeUrl"],
] as const;

function normalizeOptionalUrl(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function getSocialUrlError(label: string, value: string | null): string | null {
  const normalized = normalizeOptionalUrl(value);
  if (!normalized) return null;
  try {
    const url = new URL(normalized);
    if (!["http:", "https:"].includes(url.protocol)) {
      return `${label} debe empezar por http:// o https://`;
    }
  } catch {
    return `${label} debe ser una URL válida`;
  }
  if (normalized.length > 240) return `${label} es demasiado largo`;
  return null;
}

export function EditTipsterProfileModal({ open, onClose, onSave, currentProfile }: EditTipsterProfileModalProps) {
  const [form, setForm] = useState<TipsterProfileEdit>({ ...currentProfile });
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const saveProfileMutation = useMutation({
    mutationFn: async (profile: TipsterProfileEdit) => {
      const res = await apiRequest("POST", "/api/tipster-profile", profile);
      return await res.json();
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(["/api/tipster-profile"], profile);
      queryClient.invalidateQueries({ queryKey: ["/api/tipster-profile"] });
      onSave(profile);
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message || "Error al guardar");
    },
  });

  useEffect(() => {
    if (open) {
      setForm({ ...currentProfile });
      setError(null);
    }
  }, [open, currentProfile]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        setError("Avatar no válido. Usa JPG, PNG o WebP.");
        return;
      }
      if (file.size > MAX_AVATAR_BYTES) {
        setError("Avatar demasiado pesado. Máximo 250 KB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm(prev => ({ ...prev, avatarUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!form.username || form.username.length < 2) {
      setError("El nombre de usuario debe tener al menos 2 caracteres");
      return;
    }
    if (!/^[a-z0-9_]{2,30}$/.test(form.username.toLowerCase())) {
      setError("Solo letras minúsculas, números y guion bajo");
      return;
    }
    if (!form.displayName.trim()) {
      setError("Nombre requerido");
      return;
    }
    if (form.displayName.trim().length > 80) {
      setError("Nombre demasiado largo");
      return;
    }
    if (form.bio.length > 160) {
      setError("La bio debe tener 160 caracteres o menos");
      return;
    }
    for (const [label, key] of SOCIAL_FIELDS) {
      const socialError = getSocialUrlError(label, form[key]);
      if (socialError) {
        setError(socialError);
        return;
      }
    }

    setError(null);
    saveProfileMutation.mutate({
      ...form,
      displayName: form.displayName.trim(),
      bio: form.bio.trim(),
      telegramUrl: normalizeOptionalUrl(form.telegramUrl),
      twitterUrl: normalizeOptionalUrl(form.twitterUrl),
      instagramUrl: normalizeOptionalUrl(form.instagramUrl),
      youtubeUrl: normalizeOptionalUrl(form.youtubeUrl),
    });
  };

  const profileUrl = form.username
    ? `oddsmark.app/tipster/${form.username.toLowerCase()}`
    : "";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm bg-zinc-950 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-zinc-100 text-sm font-bold">Editar ficha pública</DialogTitle>
          <DialogDescription className="sr-only">
            Configura el nombre, nombre de usuario, descripción opcional, avatar y enlaces visibles en tu ficha pública.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Avatar + Name */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => fileRef.current?.click()}
              className="w-14 h-14 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center overflow-hidden hover:border-zinc-600 transition-colors shrink-0"
            >
              {form.avatarUrl ? (
                <img src={form.avatarUrl} className="w-full h-full object-cover" alt="" />
              ) : (
                <Camera className="w-5 h-5 text-zinc-500" />
              )}
            </button>
            <div className="flex-1 space-y-2">
              <Input
                value={form.displayName}
                onChange={(e) => setForm(prev => ({ ...prev, displayName: e.target.value }))}
                placeholder="Tu nombre"
                className="bg-zinc-900 border-zinc-700 text-zinc-200 h-9"
                maxLength={80}
              />
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-600 text-xs">@</span>
                <Input
                  value={form.username}
                  onChange={(e) => setForm(prev => ({ ...prev, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") }))}
                  placeholder="nombre_usuario"
                  className="bg-zinc-900 border-zinc-700 text-zinc-200 h-8 text-xs font-mono"
                  maxLength={30}
                />
              </div>
            </div>
            <input type="file" ref={fileRef} className="hidden" onChange={handleImageUpload} accept="image/*" />
          </div>

          {/* Profile URL preview */}
          {profileUrl && (
            <div className="flex items-center gap-1.5 px-2 py-1.5 bg-zinc-900 rounded border border-zinc-800">
              <Link2 className="w-3 h-3 text-zinc-600 shrink-0" />
              <span className="text-[11px] text-zinc-500 font-mono truncate">{profileUrl}</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 rounded border border-zinc-800 bg-zinc-900 px-3 py-2">
            <div className="min-w-0">
              <p className="text-xs font-medium text-zinc-300">Ficha pública</p>
              <p className="mt-0.5 text-[10px] leading-snug text-zinc-500">
                Visible con métricas verificadas y enlaces sociales.
              </p>
            </div>
            <Switch
              checked={form.isPublic}
              onCheckedChange={(checked) => setForm(prev => ({ ...prev, isPublic: checked }))}
              aria-label="Activar ficha pública"
            />
          </div>

          {/* Bio */}
          <Textarea
            value={form.bio}
            onChange={(e) => setForm(prev => ({ ...prev, bio: e.target.value }))}
            placeholder="Descripción opcional: enfoque, deportes, stake..."
            className="bg-zinc-900 border-zinc-700 text-zinc-200 resize-none text-sm"
            rows={2}
            maxLength={160}
          />
          <div className="flex items-center justify-between text-[10px] text-zinc-600">
            <span>Opcional, visible en tu perfil público.</span>
            <span className="font-mono">{form.bio.length}/160</span>
          </div>

          {/* Social Links */}
          <div className="space-y-1.5">
            <p className="text-[10px] text-zinc-500">Redes sociales</p>
            <SocialInput
              value={form.telegramUrl || ""}
              onChange={(v) => setForm(prev => ({ ...prev, telegramUrl: v || null }))}
              placeholder="https://t.me/tu_canal"
              label="Telegram"
            />
            <SocialInput
              value={form.twitterUrl || ""}
              onChange={(v) => setForm(prev => ({ ...prev, twitterUrl: v || null }))}
              placeholder="https://x.com/tu_perfil"
              label="Twitter"
            />
            <SocialInput
              value={form.instagramUrl || ""}
              onChange={(v) => setForm(prev => ({ ...prev, instagramUrl: v || null }))}
              placeholder="https://instagram.com/tu_perfil"
              label="Instagram"
            />
            <SocialInput
              value={form.youtubeUrl || ""}
              onChange={(v) => setForm(prev => ({ ...prev, youtubeUrl: v || null }))}
              placeholder="https://youtube.com/@tu_canal"
              label="YouTube"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-400 text-center">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1 border-zinc-700 text-zinc-400 h-9">
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saveProfileMutation.isPending} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-9">
              {saveProfileMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-3.5 h-3.5 mr-1.5" />Guardar</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SocialInput({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-zinc-600 w-16 shrink-0">{label}</span>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-zinc-900 border-zinc-700 text-zinc-200 h-8 text-xs"
      />
    </div>
  );
}
