import { apiRequest } from "@/lib/queryClient";
import type { UserConfig } from "@shared/schema";

const defaultConfig = {
  unitValue: 10,
  initialCapital: 0,
  targetBankroll: 0,
  currency: "units" as const,
};

function normalizeConfig(config: Partial<UserConfig> | null | undefined): UserConfig {
  return {
    id: config?.id ?? 1,
    userId: config?.userId ?? "",
    unitValue: config?.unitValue ?? defaultConfig.unitValue,
    initialCapital: config?.initialCapital ?? defaultConfig.initialCapital,
    targetBankroll: config?.targetBankroll ?? defaultConfig.targetBankroll,
    currency: config?.currency ?? defaultConfig.currency,
    createdAt: config?.createdAt ? new Date(config.createdAt) : null,
    updatedAt: config?.updatedAt ? new Date(config.updatedAt) : null,
  };
}

export const profileService = {
  async getProfile(): Promise<UserConfig | null> {
    const res = await apiRequest("GET", "/api/config");
    return normalizeConfig(await res.json());
  },

  async upsertProfile(config: Partial<UserConfig>): Promise<UserConfig> {
    const res = await apiRequest("POST", "/api/config", config);
    return normalizeConfig(await res.json());
  },
};
