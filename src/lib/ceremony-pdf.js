import pdfMake from 'pdfmake/build/pdfmake';

const ACCENT = '#F7931A';
const TEXT_MUTED = '#666666';
const BORDER = '#dddddd';
const BG_LIGHT = '#f8f8f8';

/**
 * Generate a ceremony reference string.
 * @returns {string} e.g. "KC-2026-A1B2"
 */
export function generateCeremonyReference() {
	const year = new Date().getFullYear();
	const seq = Date.now().toString(36).toUpperCase().slice(-4);
	return `KC-${year}-${seq}`;
}

/**
 * Build key holder table rows for pdfmake.
 */
function buildKeyHolderRows(keyCount, keyHolders) {
	const rows = [];
	for (let i = 0; i < keyCount; i++) {
		const raw = keyHolders[i] || keyHolders[String(i)];
		const holderList = Array.isArray(raw) ? raw : (raw && raw.name) ? [raw] : [{}];

		for (let j = 0; j < holderList.length; j++) {
			const holder = holderList[j];
			const name = holder.name || `Key ${i + 1}`;
			const role = holder.role === 'Custom'
				? (holder.customRole || '')
				: (holder.role || '');
			const device = holder.deviceType || '';
			const fp = j === 0 ? (holder.fingerprint || '\u2014') : '';

			rows.push([
				{ text: fp, font: fp !== '\u2014' ? 'Courier' : undefined, fontSize: 8 },
				name,
				role,
				device
			]);
		}
	}
	return rows;
}

/**
 * Build storage location table rows for pdfmake.
 */
function buildStorageRows(keyCount, keyHolders) {
	const rows = [];
	for (let i = 0; i < keyCount; i++) {
		const raw = keyHolders[i] || keyHolders[String(i)];
		const holderList = Array.isArray(raw) ? raw : (raw && raw.name) ? [raw] : [{}];
		const fp = holderList[0]?.fingerprint || '\u2014';

		for (let j = 0; j < holderList.length; j++) {
			const holder = holderList[j];
			const deviceLoc = holder.deviceLocation || '\u2014';
			const seedLoc = holder.seedBackupLocation || '\u2014';

			rows.push([
				{ text: j === 0 ? fp : '', font: fp !== '\u2014' && j === 0 ? 'Courier' : undefined, fontSize: 8 },
				deviceLoc,
				seedLoc
			]);
		}
	}
	return rows;
}

/**
 * Build recovery section content for pdfmake.
 */
function buildRecoveryContent(recoveryInstructions) {
	if (!recoveryInstructions) return [];
	const items = [];

	const fields = [
		['walletSoftware', 'Recommended Software'],
		['descriptorStorage', 'Descriptor Storage'],
		['emergencySteps', 'Recovery Steps'],
		['emergencyContacts', 'Emergency Contacts'],
		['additionalNotes', 'Additional Notes']
	];

	for (const [key, label] of fields) {
		if (recoveryInstructions[key]) {
			items.push(
				{ text: label, style: 'dtLabel', margin: [0, 6, 0, 2] },
				{ text: recoveryInstructions[key], style: 'ddValue', margin: [0, 0, 0, 4] }
			);
		}
	}

	return items;
}

/**
 * Page header content builder.
 */
function pageHeader(ceremonyRef) {
	return {
		columns: [
			{ text: 'Key Ceremony Record', style: 'pageHeaderTitle' },
			{ text: ceremonyRef, style: 'pageHeaderRef', alignment: 'right' }
		],
		margin: [0, 0, 0, 12]
	};
}

/**
 * Generate the ceremony PDF in the browser and trigger a download.
 *
 * @param {object} params
 * @param {object} params.walletConfig - { keyCount, quorumRequired, walletType }
 * @param {object} params.keyHolders - per-key holder info { 0: [{name, role, ...}], ... }
 * @param {object} params.recoveryInstructions - recovery instructions
 * @returns {{ ceremonyReference: string, ceremonyDate: string }}
 */
export function generateCeremonyPdf({ walletConfig, keyHolders, recoveryInstructions }) {
	const ceremonyRef = generateCeremonyReference();
	const ceremonyDate = new Date().toLocaleDateString('en-AU', {
		day: '2-digit', month: '2-digit', year: 'numeric'
	});

	const keyHolderRows = buildKeyHolderRows(walletConfig.keyCount, keyHolders || {});
	const storageRows = buildStorageRows(walletConfig.keyCount, keyHolders || {});
	const recoveryContent = buildRecoveryContent(recoveryInstructions || {});

	const docDefinition = {
		pageSize: 'A4',
		pageMargins: [50, 50, 50, 60],
		defaultStyle: {
			fontSize: 10,
			lineHeight: 1.4
		},
		styles: {
			coverTitle: { fontSize: 28, bold: true, color: ACCENT, alignment: 'center' },
			coverSubtitle: { fontSize: 14, color: TEXT_MUTED, alignment: 'center', margin: [0, 4, 0, 40] },
			coverFooter: { fontSize: 8, color: TEXT_MUTED, alignment: 'center', margin: [0, 40, 0, 0] },
			pageHeaderTitle: { fontSize: 11, bold: true, color: ACCENT },
			pageHeaderRef: { fontSize: 9, color: TEXT_MUTED, font: 'Courier' },
			sectionTitle: { fontSize: 15, bold: true, color: ACCENT, margin: [0, 0, 0, 8] },
			subTitle: { fontSize: 11, bold: true, margin: [0, 12, 0, 4] },
			smallText: { fontSize: 8.5, color: TEXT_MUTED, margin: [0, 0, 0, 8] },
			dtLabel: { fontSize: 9, color: TEXT_MUTED, bold: true },
			ddValue: { fontSize: 9 },
			tableHeader: { fontSize: 8.5, bold: true, color: TEXT_MUTED, fillColor: BG_LIGHT },
			docFooter: { fontSize: 7.5, color: TEXT_MUTED, alignment: 'center' }
		},
		content: [
			// --- Cover Page ---
			{ text: '', margin: [0, 120, 0, 0] },
			{ text: 'Key Ceremony Record', style: 'coverTitle' },
			{ text: 'Bitcoin Multisig Wallet Documentation', style: 'coverSubtitle' },
			{
				margin: [60, 0, 60, 0],
				table: {
					widths: [120, '*'],
					body: [
						[{ text: 'Reference', style: 'dtLabel' }, { text: ceremonyRef, bold: true }],
						[{ text: 'Date', style: 'dtLabel' }, { text: ceremonyDate, bold: true }],
						[{ text: 'Wallet Type', style: 'dtLabel' }, { text: walletConfig.walletType || '', bold: true }],
						[{ text: 'Quorum', style: 'dtLabel' }, { text: `${walletConfig.quorumRequired}-of-${walletConfig.keyCount}`, bold: true }]
					]
				},
				layout: {
					hLineWidth: () => 0.5,
					vLineWidth: () => 0.5,
					hLineColor: () => BORDER,
					vLineColor: () => BORDER,
					paddingLeft: () => 8,
					paddingRight: () => 8,
					paddingTop: () => 5,
					paddingBottom: () => 5
				}
			},
			{ text: 'Generated by Key Ceremony', style: 'coverFooter' },

			// --- Wallet Summary Page ---
			{ text: '', pageBreak: 'before' },
			pageHeader(ceremonyRef),
			{ text: 'Wallet Summary', style: 'sectionTitle' },
			{
				columns: [
					{
						width: '*',
						margin: [0, 0, 8, 0],
						table: {
							widths: ['*'],
							body: [
								[{ text: 'WALLET TYPE', style: 'dtLabel', border: [false, false, false, false] }],
								[{ text: walletConfig.walletType || '', fontSize: 14, bold: true, border: [false, false, false, false] }]
							]
						},
						layout: {
							hLineWidth: () => 0.5,
							vLineWidth: () => 0.5,
							hLineColor: () => BORDER,
							vLineColor: () => BORDER,
							paddingLeft: () => 8,
							paddingRight: () => 8,
							paddingTop: () => 5,
							paddingBottom: () => 5
						}
					},
					{
						width: '*',
						margin: [8, 0, 0, 0],
						table: {
							widths: ['*'],
							body: [
								[{ text: 'QUORUM', style: 'dtLabel', border: [false, false, false, false] }],
								[{ text: `${walletConfig.quorumRequired} of ${walletConfig.keyCount}`, fontSize: 14, bold: true, border: [false, false, false, false] }]
							]
						},
						layout: {
							hLineWidth: () => 0.5,
							vLineWidth: () => 0.5,
							hLineColor: () => BORDER,
							vLineColor: () => BORDER,
							paddingLeft: () => 8,
							paddingRight: () => 8,
							paddingTop: () => 5,
							paddingBottom: () => 5
						}
					}
				]
			},
			{
				text: 'This document records the setup of a Bitcoin multisig wallet, including key holder details, storage locations, and recovery procedures. It should be stored securely alongside the wallet output descriptor.',
				style: 'smallText',
				margin: [0, 12, 0, 0]
			},

			// --- Key Holders Page ---
			{ text: '', pageBreak: 'before' },
			pageHeader(ceremonyRef),
			{ text: 'Key Holders', style: 'sectionTitle' },
			{ text: 'Each row represents one key in the multisig wallet and the person or entity responsible for it.', style: 'smallText' },
			{
				table: {
					headerRows: 1,
					widths: [60, '*', 80, 90],
					body: [
						[
							{ text: 'FINGERPRINT', style: 'tableHeader' },
							{ text: 'NAME', style: 'tableHeader' },
							{ text: 'ROLE', style: 'tableHeader' },
							{ text: 'DEVICE', style: 'tableHeader' }
						],
						...keyHolderRows
					]
				},
				layout: {
					hLineWidth: () => 0.5,
					vLineWidth: () => 0.5,
					hLineColor: () => BORDER,
					vLineColor: () => BORDER,
					paddingLeft: () => 6,
					paddingRight: () => 6,
					paddingTop: () => 4,
					paddingBottom: () => 4
				}
			},
			{ text: 'Storage Locations', style: 'subTitle' },
			{
				table: {
					headerRows: 1,
					widths: [60, '*', '*'],
					body: [
						[
							{ text: 'FINGERPRINT', style: 'tableHeader' },
							{ text: 'DEVICE LOCATION', style: 'tableHeader' },
							{ text: 'SEED BACKUP LOCATION', style: 'tableHeader' }
						],
						...storageRows
					]
				},
				layout: {
					hLineWidth: () => 0.5,
					vLineWidth: () => 0.5,
					hLineColor: () => BORDER,
					vLineColor: () => BORDER,
					paddingLeft: () => 6,
					paddingRight: () => 6,
					paddingTop: () => 4,
					paddingBottom: () => 4
				}
			},

			// --- Recovery Procedure Page ---
			{ text: '', pageBreak: 'before' },
			pageHeader(ceremonyRef),
			{ text: 'Recovery Procedure', style: 'sectionTitle' },
			{ text: 'The following instructions document how to reconstruct this wallet in case of emergency. This information should be stored securely alongside the wallet descriptor.', style: 'smallText' },
			...recoveryContent
		],
		footer: (currentPage, pageCount) => {
			if (currentPage === 1) return null;
			return {
				text: `Key Ceremony Record \u2014 ${ceremonyRef} \u2014 ${ceremonyDate}`,
				style: 'docFooter',
				margin: [50, 10, 50, 0]
			};
		}
	};

	pdfMake.createPdf(docDefinition).download(`${ceremonyRef}.pdf`);

	return { ceremonyReference: ceremonyRef, ceremonyDate };
}
