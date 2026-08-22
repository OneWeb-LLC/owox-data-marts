import { supabaseRest } from './supabase.js';
import { DEFAULT_ACTIVATION_KIND, getOwebAppId } from './constants.js';

/** Record app activation for OneID telemetry (Layer 3). Failures are non-fatal. */
export async function activateOwoxApp(userId: string): Promise<void> {
  try {
    await supabaseRest('rpc/ao_upsert_app_activation', {
      method: 'POST',
      body: JSON.stringify({
        p_app_id: getOwebAppId(),
        p_user_id: userId,
        p_activation_kind: process.env.OWEB_ACTIVATION_KIND || DEFAULT_ACTIVATION_KIND,
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[oweb] app activation failed: ${message}`);
  }
}
