import cron from 'node-cron';
import { getExpiredUsers, purgeUser } from './db.js';

/**
 * Start the purge scheduler.
 * Runs daily at 3:00 AM to delete expired user accounts.
 */
export function startPurgeScheduler() {
	cron.schedule('0 3 * * *', () => {
		const expired = getExpiredUsers.all();
		for (const { user_id } of expired) {
			purgeUser.run(user_id);
			console.log(`Purged user ${user_id}`);
		}
		if (expired.length > 0) {
			console.log(`Purge complete: ${expired.length} user(s) removed`);
		}
	});

	console.log('Purge scheduler started (daily at 03:00)');
}
