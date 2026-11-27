/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  /** Cloudflare Web Analytics site token. Unset omits the beacon. */
  readonly PUBLIC_CF_WEB_ANALYTICS_TOKEN?: string;
}