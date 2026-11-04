/* RunDownRec client index — renders data/*.json into the table. */
(() => {
	'use strict';

	const TABS = {
		clients: { file: 'data/clients.json', heading: 'Clients' },
		special: { file: 'data/special-clients.json', heading: 'Special Clients' },
	};

	const STATUS_LABEL = {
		ready: 'Ready',
		partial: 'Partial',
		broken: 'Broken',
		archived: 'Archived',
	};

	const root = document.documentElement;
	const main = document.querySelector('[data-main]');
	const rowsBody = document.querySelector('[data-rows]');
	const rowTemplate = document.querySelector('[data-row-template]');
	const searchInput = document.getElementById('client-search');
	const clearButton = document.getElementById('clear-search');
	const statusFilter = document.getElementById('status-filter');
	const versionFilter = document.getElementById('version-filter');
	const resultsCount = document.querySelector('[data-results-count]');
	const emptyMessage = document.querySelector('[data-empty]');
	const heading = document.querySelector('[data-tab-heading]');

	const cache = new Map();
	let entries = [];
	let activeTab = 'clients';
	let sort = { field: 'date', dir: 'desc' };

	/* Helpers -------------------------------------------------------------- */

	const numberFmt = new Intl.NumberFormat('en');

	function formatBytes(bytes) {
		if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
		const units = ['B', 'KB', 'MB', 'GB', 'TB'];
		const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
		const value = bytes / 1024 ** index;
		return `${value >= 100 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
	}

	function formatDate(value) {
		if (!value) return '';
		const stamp = new Date(value);
		if (Number.isNaN(stamp.getTime())) return String(value);
		return stamp.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
	}

	function formatStamp(value) {
		if (!value) return '';
		const stamp = new Date(value);
		if (Number.isNaN(stamp.getTime())) return String(value);
		return stamp.toLocaleString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	}

	function totalSize(entry) {
		return entry.files.reduce((sum, file) => sum + (Number(file.size) || 0), 0);
	}

	async function loadJson(path) {
		if (cache.has(path)) return cache.get(path);
		const response = await fetch(path, { cache: 'no-store' });
		if (!response.ok) throw new Error(`${path} returned ${response.status}`);
		const data = await response.json();
		cache.set(path, data);
		return data;
	}

	function normalizeEntry(raw, index) {
		const files = Array.isArray(raw.files) ? raw.files : [];
		return {
			name: String(raw.name || `Untitled client ${index + 1}`),
			version: String(raw.version || ''),
			date: String(raw.date || ''),
			manifestId: String(raw.manifestId || ''),
			status: STATUS_LABEL[raw.status] ? String(raw.status) : 'ready',
			notes: String(raw.notes || ''),
			uploadedAt: String(raw.uploadedAt || ''),
			files: files.map((file) => ({
				label: String(file.label || file.path || 'download'),
				path: String(file.path || ''),
				size: Number(file.size) || 0,
				sha256: String(file.sha256 || ''),
			})),
		};
	}

	/* Clipboard ------------------------------------------------------------ */

	let tooltipNode = null;

	function showTooltip(anchor, text) {
		hideTooltip();
		const box = document.createElement('div');
		box.className = 'tooltip';
		box.setAttribute('role', 'status');
		box.append(text);
		const arrow = document.createElement('span');
		arrow.className = 'tooltip-arrow';
		arrow.setAttribute('aria-hidden', 'true');
		box.append(arrow);
		document.body.append(box);

		const rect = anchor.getBoundingClientRect();
		const left = Math.min(
			Math.max(rect.left + rect.width / 2 - box.offsetWidth / 2, 8),
			window.innerWidth - box.offsetWidth - 8,
		);
		box.style.left = `${left}px`;
		box.style.top = `${rect.top - box.offsetHeight - 8}px`;
		tooltipNode = box;
		window.setTimeout(hideTooltip, 1600);
	}

	function hideTooltip() {
		if (tooltipNode) {
			tooltipNode.remove();
			tooltipNode = null;
		}
	}

	function copyViaTextarea(text) {
		const scratch = document.createElement('textarea');
		scratch.value = text;
		scratch.setAttribute('readonly', '');
		scratch.style.position = 'fixed';
		scratch.style.opacity = '0';
		document.body.append(scratch);
		scratch.select();
		const ok = document.execCommand('copy');
		scratch.remove();
		if (!ok) throw new Error('execCommand copy was rejected');
	}

	async function writeClipboard(text) {
		if (navigator.clipboard && window.isSecureContext) {
			try {
				await navigator.clipboard.writeText(text);
				return;
			} catch (error) {
				/* unfocused window or permissions policy — legacy path below */
			}
		}
		copyViaTextarea(text);
	}

	function wireCopy(button, text, message) {
		button.addEventListener('click', async () => {
			try {
				await writeClipboard(text);
				button.dataset.copied = '';
				showTooltip(button, message);
				window.setTimeout(() => delete button.dataset.copied, 1600);
			} catch (error) {
				showTooltip(button, 'Copy blocked by the browser');
			}
		});
	}

	/* Rendering ------------------------------------------------------------ */

	function buildRow(entry) {
		const node = rowTemplate.content.firstElementChild.cloneNode(true);
		const status = node.querySelector('[data-status]');
		status.dataset.status = entry.status;
		status.setAttribute('aria-label', `${STATUS_LABEL[entry.status]} status`);
		status.title = STATUS_LABEL[entry.status];

		node.querySelector('[data-name]').textContent = entry.name;
		node.querySelector('[data-notes]').textContent = entry.notes;
		node.querySelector('[data-version]').textContent = entry.version || 'unversioned';

		const dateCell = node.querySelector('[data-date]');
		dateCell.textContent = formatDate(entry.date);
		dateCell.setAttribute('datetime', entry.date);

		const uploaded = node.querySelector('[data-uploaded]');
		uploaded.textContent = entry.uploadedAt ? formatStamp(entry.uploadedAt) : '—';
		uploaded.setAttribute('datetime', entry.uploadedAt);

		const manifestButton = node.querySelector('[data-copy]');
		const manifestCell = node.querySelector('[data-manifest]');
		if (entry.manifestId) {
			manifestCell.textContent = entry.manifestId;
			wireCopy(manifestButton, entry.manifestId, 'Manifest ID copied');
		} else {
			manifestCell.textContent = '—';
			manifestButton.disabled = true;
			manifestButton.style.visibility = 'hidden';
		}

		const list = node.querySelector('[data-files]');
		if (!entry.files.length) {
			const missing = document.createElement('li');
			missing.className = 'file-missing';
			missing.textContent = 'No file attached';
			list.append(missing);
		}
		for (const file of entry.files) {
			const item = document.createElement('li');
			const link = document.createElement('a');
			link.href = file.path;
			link.textContent = file.label;
			link.setAttribute('download', '');
			item.append(link);

			const size = document.createElement('span');
			size.className = 'file-size';
			size.textContent = file.size ? formatBytes(file.size) : 'unknown size';
			item.append(size);

			if (file.sha256) {
				const hash = document.createElement('button');
				hash.type = 'button';
				hash.className = 'file-hash';
				hash.textContent = file.sha256.slice(0, 8);
				hash.title = `SHA-256 ${file.sha256} — click to copy`;
				wireCopy(hash, file.sha256, 'Checksum copied');
				item.append(hash);
			}
			list.append(item);
		}
		return node;
	}

	function sortValue(entry) {
		switch (sort.field) {
			case 'name':
				return entry.name.toLowerCase();
			case 'version':
				return entry.version.toLowerCase();
			case 'manifestId':
				return entry.manifestId.toLowerCase();
			case 'uploadedAt':
				return entry.uploadedAt || '';
			case 'files':
				return totalSize(entry);
			case 'date':
			default:
				return entry.date || '';
		}
	}

	function visibleEntries() {
		const needle = searchInput.value.trim().toLowerCase();
		const status = statusFilter.value;
		const version = versionFilter.value;

		return entries
			.filter((entry) => {
				if (status !== 'all' && entry.status !== status) return false;
				if (version !== 'all' && (entry.version || 'unversioned') !== version) return false;
				if (!needle) return true;
				const haystack = [
					entry.name,
					entry.version,
					entry.manifestId,
					entry.notes,
					entry.date,
					STATUS_LABEL[entry.status],
				]
					.join(' ')
					.toLowerCase();
				return haystack.includes(needle);
			})
			.sort((a, b) => {
				const left = sortValue(a);
				const right = sortValue(b);
				if (left === right) return a.name.localeCompare(b.name);
				const direction = sort.dir === 'desc' ? -1 : 1;
				return left > right ? direction : -direction;
			});
	}

	function render() {
		const shown = visibleEntries();
		rowsBody.replaceChildren(...shown.map(buildRow));
		emptyMessage.hidden = shown.length !== 0;

		const noun = activeTab === 'special' ? 'special client' : 'client';
		resultsCount.textContent = `Showing ${numberFmt.format(shown.length)} of ${numberFmt.format(entries.length)} ${noun}${entries.length === 1 ? '' : 's'}`;

		document.querySelector('[data-stat=entries]').textContent = numberFmt.format(entries.length);
		const fileCount = entries.reduce((sum, entry) => sum + entry.files.length, 0);
		const byteTotal = entries.reduce((sum, entry) => sum + totalSize(entry), 0);
		document.querySelector('[data-stat=files]').textContent = numberFmt.format(fileCount);
		document.querySelector('[data-stat=size]').textContent = formatBytes(byteTotal);

		for (const button of main.querySelectorAll('th button[data-sort]')) {
			const isActive = button.dataset.sort === sort.field;
			button.setAttribute('aria-pressed', String(isActive));
			button.dataset.dir = sort.dir;
		}
		clearButton.hidden = searchInput.value === '';
	}

	function syncTabs() {
		for (const link of document.querySelectorAll('[data-tabs] a')) {
			const isCurrent = link.dataset.tab === activeTab;
			if (isCurrent) link.setAttribute('aria-current', 'page');
			else link.removeAttribute('aria-current');
		}
		heading.textContent = TABS[activeTab].heading;
	}

	function rebuildVersionFilter() {
		const selected = versionFilter.value;
		versionFilter.replaceChildren();
		const all = document.createElement('option');
		all.value = 'all';
		all.textContent = 'All versions';
		versionFilter.append(all);

		const versions = [...new Set(entries.map((entry) => entry.version || 'unversioned'))].sort().reverse();
		for (const version of versions) {
			const option = document.createElement('option');
			option.value = version;
			option.textContent = version;
			versionFilter.append(option);
		}
		versionFilter.value = versions.includes(selected) ? selected : 'all';
	}

	async function selectTab(tab) {
		activeTab = TABS[tab] ? tab : 'clients';
		syncTabs();
		try {
			const payload = await loadJson(TABS[activeTab].file);
			const list = Array.isArray(payload) ? payload : payload.entries;
			entries = (Array.isArray(list) ? list : []).map(normalizeEntry);
		} catch (error) {
			entries = [];
			resultsCount.textContent = `Could not load ${TABS[activeTab].file}: ${error.message}`;
		}
		searchInput.value = '';
		statusFilter.value = 'all';
		rebuildVersionFilter();
		render();
	}

	function tabFromHash() {
		const candidate = window.location.hash.replace('#', '');
		return TABS[candidate] ? candidate : 'clients';
	}

	/* Wiring --------------------------------------------------------------- */

	for (const button of main.querySelectorAll('th button[data-sort]')) {
		button.addEventListener('click', () => {
			const field = button.dataset.sort;
			if (sort.field === field) sort.dir = sort.dir === 'asc' ? 'desc' : 'asc';
			else sort = { field, dir: field === 'name' || field === 'version' ? 'asc' : 'desc' };
			render();
		});
	}

	searchInput.addEventListener('input', render);
	statusFilter.addEventListener('change', render);
	versionFilter.addEventListener('change', render);
	clearButton.addEventListener('click', () => {
		searchInput.value = '';
		searchInput.focus();
		render();
	});
	window.addEventListener('hashchange', () => selectTab(tabFromHash()));
	window.addEventListener('scroll', hideTooltip, { passive: true });

	const themeToggle = document.getElementById('theme-toggle');
	themeToggle.addEventListener('click', () => {
		const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
		root.setAttribute('data-theme', next);
		root.style.colorScheme = next;
		root.style.backgroundColor = next === 'dark' ? '#0a0a0a' : '#fff';
		try {
			localStorage.setItem('theme', next);
		} catch (error) {
			/* private mode — the toggle still works for this page view */
		}
	});

	async function applySettings() {
		try {
			const settings = await loadJson('data/settings.json');
			if (settings.siteName) document.querySelector('[data-site-name]').textContent = settings.siteName;
			if (settings.tag) document.querySelector('[data-site-tag]').textContent = settings.tag;
			if (settings.intro) document.querySelector('[data-site-intro]').textContent = settings.intro;
			document.title = `${settings.siteName || 'RunDownRec'} ${settings.tag || 'Clients'}`;
			const holder = document.querySelector('[data-site-links]');
			(settings.links || []).forEach((link, index) => {
				if (index) holder.append(' · ');
				const anchor = document.createElement('a');
				anchor.href = link.url;
				anchor.textContent = link.label;
				anchor.target = '_blank';
				anchor.rel = 'noopener noreferrer';
				holder.append(anchor);
			});
		} catch (error) {
			/* settings are optional; the defaults baked into index.html stand */
		}
	}

	applySettings();
	selectTab(tabFromHash());
})();
