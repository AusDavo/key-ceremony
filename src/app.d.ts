// See https://svelte.dev/docs/kit/types#app.d.ts

declare global {
	namespace App {
		interface Locals {
			user?: {
				user_id: string;
				workflow_state: string;
				encrypted_blob: Buffer | null;
				iv: string | null;
				created_at: string;
				purge_after: string | null;
			};
		}
	}
}

export {};
