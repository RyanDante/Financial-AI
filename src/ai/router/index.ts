import type { AIProvider } from '../providers/types';

export interface AIRouterProviders {
  local?: AIProvider;
  cloud?: AIProvider;
  /** Always available — used until local/cloud providers are wired up, and whenever neither is reachable. */
  fallback: AIProvider;
}

/**
 * Decides which provider should answer a given request. Today there is no
 * local or cloud provider implemented, so every request falls through to
 * `fallback`. The shape is here so that wiring in a real local model later
 * is a matter of filling in `local` and changing the decision rule below —
 * nothing upstream (the AI store, the AI screen) needs to change.
 */
export class AIRouter {
  constructor(private providers: AIRouterProviders) {}

  selectProvider(): AIProvider {
    if (this.providers.local?.isAvailableOffline) {
      return this.providers.local;
    }
    return this.providers.cloud ?? this.providers.fallback;
  }
}
