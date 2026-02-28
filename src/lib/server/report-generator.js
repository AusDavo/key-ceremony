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

export function hashDescriptor(descriptor) {
	return createHash('sha256').update(descriptor.trim()).digest('hex');
}

function computeRating(quorumRequired, totalSigners, quorumAchieved) {
	if (quorumAchieved >= totalSigners) {
		return { quorumResult: 'Exceeded', rating: 'A+' };
	} else if (quorumAchieved >= quorumRequired) {
		return { quorumResult: 'Met', rating: 'A' };
	} else {
		return { quorumResult: 'Not Met', rating: 'F' };
	}
}

function buildKeyHolderRows(xpubs, keyHolders, signatures) {
	const rows = [];
	for (let i = 0; i < xpubs.length; i++) {
		const xpub = xpubs[i];
		const raw = keyHolders[i] || keyHolders[String(i)];
		const holderList = Array.isArray(raw) ? raw : (raw && raw.name) ? [raw] : [{}];
		const signed = signatures && (signatures[i] != null || signatures[String(i)] != null);
		const fp = xpub.xpubFingerprint !== 'unknown'
			? `<code>${escapeHtml(xpub.xpubFingerprint)}</code>`
			: '&mdash;';
		const verifiedCell = signed
			? '<td class="verified">Verified</td>'
			: '<td class="not-verified">Not verified</td>';

		for (let j = 0; j < holderList.length; j++) {
			const holder = holderList[j];
			const name = escapeHtml(holder.name || `Key ${i + 1}`);
			const role = holder.role === 'Custom'
				? escapeHtml(holder.customRole || '')
				: escapeHtml(holder.role || '');
			const device = escapeHtml(holder.deviceType || '');

			rows.push(`      <tr>
        <td>${j === 0 ? fp : ''}</td>
        <td>${name}</td>
        <td>${role}</td>
        <td>${device}</td>
        ${j === 0 ? verifiedCell : '<td></td>'}
      </tr>`);
		}
	}
	return rows.join('\n');
}

function buildTechnicalRows(xpubs) {
	return xpubs.map((xpub, i) => {
		const fp = xpub.xpubFingerprint !== 'unknown'
			? escapeHtml(xpub.xpubFingerprint)
			: '&mdash;';
		const truncatedXpub = xpub.xpub
			? escapeHtml(xpub.xpub.slice(0, 20) + '...' + xpub.xpub.slice(-8))
			: '&mdash;';
		const path = xpub.derivationPath
			? `<code>${escapeHtml(xpub.derivationPath)}</code>`
			: '&mdash;';
		return `      <tr>
        <td>${i + 1}</td>
        <td><code>${fp}</code></td>
        <td><code>${truncatedXpub}</code></td>
        <td>${path}</td>
      </tr>`;
	}).join('\n');
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
 * @param {object} params.descriptorParsed - parsed descriptor
 * @param {string} params.descriptorRaw - raw descriptor string
 * @param {object} params.signingChallenge - { challenge, blockHeight, blockHash }
 * @param {number} params.quorumAchieved - number of signatures collected
 * @param {object} params.signatures - per-xpub signatures { 0: '...', 1: '...', ... }
 * @param {object} params.keyHolders - per-xpub key holder info { 0: {name, role, ...}, ... }
 * @param {object} params.recoveryInstructions - recovery instructions
 *
 * @returns {{ ceremonyReference, ceremonyDate, descriptorHash, documentHash, buildDir }}
 */
export function generateCeremonyDocument(params) {
	const {
		descriptorParsed,
		descriptorRaw,
		signingChallenge,
		quorumAchieved,
		signatures,
		keyHolders,
		recoveryInstructions
	} = params;

	const ceremonyRef = generateCeremonyReference();
	const ceremonyDate = new Date().toLocaleDateString('en-AU', {
		day: '2-digit', month: '2-digit', year: 'numeric'
	});
	const descriptorHash = hashDescriptor(descriptorRaw);

	const quorum = descriptorParsed.quorum || {
		required: 1,
		total: descriptorParsed.xpubs.length
	};
	const { quorumResult, rating } = computeRating(
		quorum.required, quorum.total, quorumAchieved
	);

	const ratingClass = rating === 'F' ? 'fail' : 'pass';

	// Prepare tmp directory
	const buildId = randomUUID();
	const buildDir = join(TMP_DIR, buildId);
	mkdirSync(buildDir, { recursive: true });

	// Build dynamic content
	const keyHolderRows = buildKeyHolderRows(descriptorParsed.xpubs, keyHolders, signatures);
	const technicalRows = buildTechnicalRows(descriptorParsed.xpubs);
	const recoveryContent = buildRecoverySection(recoveryInstructions || {});

	// Read and populate template
	let template = readFileSync(join(TEMPLATES_DIR, 'ceremony-template.html'), 'utf8');

	const replacements = {
		'{{CEREMONY_REFERENCE}}': ceremonyRef,
		'{{CEREMONY_DATE}}': ceremonyDate,
		'{{DESCRIPTOR_HASH}}': descriptorHash,
		'{{ADDRESS_TYPE}}': escapeHtml(descriptorParsed.addressTypeLabel || descriptorParsed.addressType || ''),
		'{{QUORUM_REQUIRED}}': quorum.required.toString(),
		'{{QUORUM_TOTAL}}': quorum.total.toString(),
		'{{QUORUM_ACHIEVED}}': quorumAchieved.toString(),
		'{{QUORUM_RESULT}}': quorumResult,
		'{{RATING}}': rating,
		'{{RATING_CLASS}}': ratingClass,
		'{{KEY_HOLDER_ROWS}}': keyHolderRows,
		'{{TECHNICAL_ROWS}}': technicalRows,
		'{{RECOVERY_CONTENT}}': recoveryContent,
		'{{CHALLENGE}}': escapeHtml(signingChallenge?.challenge || ''),
		'{{BLOCK_HEIGHT}}': (signingChallenge?.blockHeight || 0).toLocaleString('en-AU'),
		'{{KEYS_VERIFIED}}': `${quorumAchieved} of ${quorum.total}`,
		'{{NETWORK}}': descriptorParsed.network || 'mainnet'
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
		descriptorHash,
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
