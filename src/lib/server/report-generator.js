import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash, randomUUID } from 'crypto';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '..', '..', '..', 'templates');
const TMP_DIR = process.env.DB_PATH
	? join(dirname(process.env.DB_PATH), 'tmp')
	: join(__dirname, '..', '..', '..', 'tmp');

const CHROMIUM_PATH = process.env.CHROMIUM_PATH || 'chromium';

function escapeHtml(str) {
	if (typeof str !== 'string') return str;
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function generateCeremonyReference() {
	const year = new Date().getFullYear();
	const seq = Date.now().toString(36).toUpperCase().slice(-4);
	return `KC-${year}-${seq}`;
}

function buildKeyHolderRows(keyCount, keyHolders) {
	const rows = [];
	for (let i = 0; i < keyCount; i++) {
		const raw = keyHolders[i] || keyHolders[String(i)];
		const holderList = Array.isArray(raw) ? raw : (raw && raw.name) ? [raw] : [{}];

		for (let j = 0; j < holderList.length; j++) {
			const holder = holderList[j];
			const name = escapeHtml(holder.name || `Key ${i + 1}`);
			const role = holder.role === 'Custom'
				? escapeHtml(holder.customRole || '')
				: escapeHtml(holder.role || '');
			const device = escapeHtml(holder.deviceType || '');
			const fp = holder.fingerprint
				? `<code>${escapeHtml(holder.fingerprint)}</code>`
				: '&mdash;';

			rows.push(`      <tr>
        <td>${j === 0 ? fp : ''}</td>
        <td>${name}</td>
        <td>${role}</td>
        <td>${device}</td>
      </tr>`);
		}
	}
	return rows.join('\n');
}

function buildStorageRows(keyCount, keyHolders) {
	const rows = [];
	for (let i = 0; i < keyCount; i++) {
		const raw = keyHolders[i] || keyHolders[String(i)];
		const holderList = Array.isArray(raw) ? raw : (raw && raw.name) ? [raw] : [{}];
		const fp = holderList[0]?.fingerprint
			? `<code>${escapeHtml(holderList[0].fingerprint)}</code>`
			: '&mdash;';

		for (let j = 0; j < holderList.length; j++) {
			const holder = holderList[j];
			const deviceLoc = escapeHtml(holder.deviceLocation || '') || '&mdash;';
			const seedLoc = escapeHtml(holder.seedBackupLocation || '') || '&mdash;';

			rows.push(`      <tr>
        <td>${j === 0 ? fp : ''}</td>
        <td>${deviceLoc}</td>
        <td>${seedLoc}</td>
      </tr>`);
		}
	}
	return rows.join('\n');
}

function buildRecoverySection(recoveryInstructions) {
	const sections = [];

	if (recoveryInstructions.walletSoftware) {
		sections.push(`<dt>Recommended Software</dt><dd>${escapeHtml(recoveryInstructions.walletSoftware)}</dd>`);
	}
	if (recoveryInstructions.descriptorStorage) {
		sections.push(`<dt>Descriptor Storage</dt><dd class="pre-wrap">${escapeHtml(recoveryInstructions.descriptorStorage)}</dd>`);
	}
	if (recoveryInstructions.emergencySteps) {
		sections.push(`<dt>Recovery Steps</dt><dd class="pre-wrap">${escapeHtml(recoveryInstructions.emergencySteps)}</dd>`);
	}
	if (recoveryInstructions.emergencyContacts) {
		sections.push(`<dt>Emergency Contacts</dt><dd class="pre-wrap">${escapeHtml(recoveryInstructions.emergencyContacts)}</dd>`);
	}
	if (recoveryInstructions.additionalNotes) {
		sections.push(`<dt>Additional Notes</dt><dd class="pre-wrap">${escapeHtml(recoveryInstructions.additionalNotes)}</dd>`);
	}

	if (sections.length === 0) return '';
	return `<dl>${sections.join('\n')}</dl>`;
}

/**
 * Generate a ceremony record PDF.
 *
 * @param {object} params
 * @param {object} params.walletConfig - { keyCount, quorumRequired, walletType }
 * @param {object} params.keyHolders - per-key holder info { 0: [{name, role, ...}], ... }
 * @param {object} params.recoveryInstructions - recovery instructions
 *
 * @returns {{ ceremonyReference, ceremonyDate, documentHash, pdfBuffer, buildDir }}
 */
export function generateCeremonyDocument(params) {
	const {
		walletConfig,
		keyHolders,
		recoveryInstructions
	} = params;

	const ceremonyRef = generateCeremonyReference();
	const ceremonyDate = new Date().toLocaleDateString('en-AU', {
		day: '2-digit', month: '2-digit', year: 'numeric'
	});

	// Prepare tmp directory
	const buildId = randomUUID();
	const buildDir = join(TMP_DIR, buildId);
	mkdirSync(buildDir, { recursive: true });

	// Build dynamic content
	const keyHolderRows = buildKeyHolderRows(walletConfig.keyCount, keyHolders);
	const storageRows = buildStorageRows(walletConfig.keyCount, keyHolders);
	const recoveryContent = buildRecoverySection(recoveryInstructions || {});

	// Read and populate template
	let template = readFileSync(join(TEMPLATES_DIR, 'ceremony-template.html'), 'utf8');

	const replacements = {
		'{{CEREMONY_REFERENCE}}': ceremonyRef,
		'{{CEREMONY_DATE}}': ceremonyDate,
		'{{WALLET_TYPE}}': escapeHtml(walletConfig.walletType || ''),
		'{{QUORUM_REQUIRED}}': walletConfig.quorumRequired.toString(),
		'{{QUORUM_TOTAL}}': walletConfig.keyCount.toString(),
		'{{KEY_HOLDER_ROWS}}': keyHolderRows,
		'{{STORAGE_ROWS}}': storageRows,
		'{{RECOVERY_CONTENT}}': recoveryContent
	};

	for (const [placeholder, value] of Object.entries(replacements)) {
		template = template.replaceAll(placeholder, value);
	}

	// Write populated HTML
	const htmlPath = join(buildDir, 'report.html');
	writeFileSync(htmlPath, template);

	// Run Chromium headless to generate PDF
	const pdfPath = join(buildDir, 'report.pdf');
	execSync(
		`"${CHROMIUM_PATH}" --headless=new --disable-gpu --no-sandbox --print-to-pdf="${pdfPath}" --no-pdf-header-footer "file://${htmlPath}"`,
		{ cwd: buildDir, timeout: 60000 }
	);

	// Hash the PDF
	const pdfBuffer = readFileSync(pdfPath);
	const documentHash = createHash('sha256').update(pdfBuffer).digest('hex');

	return {
		ceremonyReference: ceremonyRef,
		ceremonyDate,
		documentHash,
		pdfBuffer,
		buildDir
	};
}

export function cleanupBuild(buildDir) {
	try {
		execSync(`rm -rf "${buildDir}"`, { timeout: 5000 });
	} catch {
		console.warn(`Failed to clean up build directory: ${buildDir}`);
	}
}
