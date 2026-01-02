/**
 * TEEP Tracker - Main Application Module
 * Handles navigation, modals, dashboard, and application state
 */

const TEEPApp = {
    // Current view
    currentView: 'dashboard',

    // Query builder state
    queryConditions: [],

    /**
     * Initialize the application
     */
    async init() {
        console.log('Initializing TEEP Tracker...');

        // Wait for storage to be ready
        await TEEPStorage.init();

        // Initialize default qualification types
        const existingTypes = await TEEPStorage.getQualificationTypes();
        if (existingTypes.length === 0) {
            await TEEPQualifications.initializeDefaultTypes();
        }

        // Load saved theme
        await this.loadTheme();

        // Bind events
        this.bindEvents();

        // Initialize roster module
        await TEEPRoster.init();

        // Render reports list
        TEEPReports.renderReportsList();

        // Load dashboard
        await this.updateDashboard();

        // Show dashboard view
        this.showView('dashboard');

        console.log('TEEP Tracker initialized successfully');
    },

    /**
     * Bind global event listeners
     */
    bindEvents() {
        // Navigation tabs
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                this.showView(view);
            });
        });

        // Theme toggle
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }

        // Modal close buttons
        document.querySelectorAll('.modal-close, [data-modal-close]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) {
                    this.closeModal(modal.id);
                }
            });
        });

        // Close modal on backdrop click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal.id);
                }
            });
        });

        // Import button
        const importBtn = document.getElementById('importBtn');
        if (importBtn) {
            importBtn.addEventListener('click', () => this.openModal('importModal'));
        }

        // Export button
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.openModal('exportModal'));
        }

        // File input for import
        const importFileInput = document.getElementById('importFile');
        if (importFileInput) {
            importFileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }

        // Import type radio buttons
        document.querySelectorAll('input[name="importType"]').forEach(radio => {
            radio.addEventListener('change', () => this.updateImportTypeUI());
        });

        // Import confirm button
        const confirmImportBtn = document.getElementById('confirmImportBtn');
        if (confirmImportBtn) {
            confirmImportBtn.addEventListener('click', () => this.executeImport());
        }

        // Export buttons
        const exportJsonBtn = document.getElementById('exportJsonBtn');
        if (exportJsonBtn) {
            exportJsonBtn.addEventListener('click', () => TEEPReports.exportJSON());
        }

        const importJsonBtn = document.getElementById('importJsonBtn');
        if (importJsonBtn) {
            importJsonBtn.addEventListener('click', () => this.handleJsonImport());
        }

        // Qualification form
        const qualForm = document.getElementById('qualificationForm');
        if (qualForm) {
            qualForm.addEventListener('submit', (e) => TEEPRoster.handleQualificationSubmit(e));
        }

        // Query builder
        const addConditionBtn = document.getElementById('addConditionBtn');
        if (addConditionBtn) {
            addConditionBtn.addEventListener('click', () => this.addQueryCondition());
        }

        const executeQueryBtn = document.getElementById('executeQueryBtn');
        if (executeQueryBtn) {
            executeQueryBtn.addEventListener('click', () => this.executeQuery());
        }

        const clearQueryBtn = document.getElementById('clearQueryBtn');
        if (clearQueryBtn) {
            clearQueryBtn.addEventListener('click', () => this.clearQuery());
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Escape closes modals
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal.active').forEach(modal => {
                    this.closeModal(modal.id);
                });
            }
        });
    },

    /**
     * Show a view/tab
     */
    showView(viewName) {
        this.currentView = viewName;

        // Update nav tabs
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.view === viewName);
        });

        // Update view sections
        document.querySelectorAll('.view-section').forEach(section => {
            section.classList.toggle('active', section.id === viewName + 'View');
        });

        // Refresh content if needed
        if (viewName === 'dashboard') {
            this.updateDashboard();
        } else if (viewName === 'roster') {
            TEEPRoster.refreshRoster();
        } else if (viewName === 'expirations') {
            this.updateExpirations();
        }
    },

    /**
     * Update dashboard stats and alerts
     */
    async updateDashboard() {
        // Get counts
        const statusCounts = await TEEPStorage.getMarineCountByStatus();
        const overdueQuals = await TEEPStorage.getOverdueQualifications();
        const expiring30 = await TEEPStorage.getExpiringQualifications(30);
        const expiring90 = await TEEPStorage.getExpiringQualifications(90);

        // Update stat cards
        this.updateStatCard('totalMarines', statusCounts.total);
        this.updateStatCard('presentMarines', statusCounts.present);
        this.updateStatCard('overdueQuals', overdueQuals.length);
        this.updateStatCard('expiring30', expiring30.length);

        // Update alerts section
        await this.updateDashboardAlerts(overdueQuals, expiring30);
    },

    /**
     * Update a stat card
     */
    updateStatCard(id, value) {
        const element = document.querySelector(`[data-stat="${id}"] .stat-value`);
        if (element) {
            element.textContent = value;
        }
    },

    /**
     * Update dashboard alerts
     */
    async updateDashboardAlerts(overdue, expiring) {
        const container = document.getElementById('dashboardAlerts');
        if (!container) return;

        const marines = await TEEPStorage.getAllMarines();
        const marineMap = new Map(marines.map(m => [m.id, m]));

        let html = '';

        // Overdue alerts
        if (overdue.length > 0) {
            html += `<div class="alert-section alert-danger">
                <h4>Overdue Qualifications (${overdue.length})</h4>
                <ul class="alert-list">
                    ${overdue.slice(0, 5).map(qual => {
                        const marine = marineMap.get(qual.marineId);
                        const qualType = TEEPQualifications.getQualificationType(qual.type);
                        return `<li>
                            <span class="marine-name">${marine?.rank} ${marine?.lastName}, ${marine?.firstName}</span>
                            <span class="qual-name">${qualType?.name || qual.type}</span>
                            <span class="expired-date">Expired ${TEEPQualifications.formatDate(qual.expirationDate)}</span>
                        </li>`;
                    }).join('')}
                    ${overdue.length > 5 ? `<li class="more-link">... and ${overdue.length - 5} more</li>` : ''}
                </ul>
            </div>`;
        }

        // Expiring soon alerts
        if (expiring.length > 0) {
            html += `<div class="alert-section alert-warning">
                <h4>Expiring in 30 Days (${expiring.length})</h4>
                <ul class="alert-list">
                    ${expiring.slice(0, 5).map(qual => {
                        const marine = marineMap.get(qual.marineId);
                        const qualType = TEEPQualifications.getQualificationType(qual.type);
                        const days = TEEPQualifications.daysUntilExpiration(qual.expirationDate);
                        return `<li>
                            <span class="marine-name">${marine?.rank} ${marine?.lastName}, ${marine?.firstName}</span>
                            <span class="qual-name">${qualType?.name || qual.type}</span>
                            <span class="days-left">${days} days</span>
                        </li>`;
                    }).join('')}
                    ${expiring.length > 5 ? `<li class="more-link">... and ${expiring.length - 5} more</li>` : ''}
                </ul>
            </div>`;
        }

        if (!html) {
            html = '<div class="no-alerts">No urgent alerts. All qualifications are current.</div>';
        }

        container.innerHTML = html;
    },

    /**
     * Update expirations view
     */
    async updateExpirations() {
        const overdue = await TEEPStorage.getOverdueQualifications();
        const expiring30 = await TEEPStorage.getExpiringQualifications(30);
        const expiring90 = await TEEPStorage.getExpiringQualifications(90);

        const marines = await TEEPStorage.getAllMarines();
        const marineMap = new Map(marines.map(m => [m.id, m]));

        // Render each section
        this.renderExpirationTable('overdueTable', overdue, marineMap);
        this.renderExpirationTable('expiring30Table', expiring30, marineMap);
        this.renderExpirationTable('expiring90Table', expiring90.filter(q =>
            TEEPQualifications.daysUntilExpiration(q.expirationDate) > 30
        ), marineMap);
    },

    /**
     * Render expiration table
     */
    renderExpirationTable(tableId, qualifications, marineMap) {
        const tbody = document.querySelector(`#${tableId} tbody`);
        if (!tbody) return;

        if (qualifications.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">None</td></tr>';
            return;
        }

        tbody.innerHTML = qualifications.map(qual => {
            const marine = marineMap.get(qual.marineId);
            const qualType = TEEPQualifications.getQualificationType(qual.type);
            const days = TEEPQualifications.daysUntilExpiration(qual.expirationDate);
            const status = TEEPQualifications.getQualificationStatus(qual);

            return `<tr>
                <td>${marine?.rank || ''}</td>
                <td>${marine?.lastName || ''}, ${marine?.firstName || ''}</td>
                <td>${qualType?.name || qual.type}</td>
                <td>${TEEPQualifications.formatDate(qual.expirationDate)}</td>
                <td>${days} days</td>
                <td><span class="status-badge ${status.class}">${status.label}</span></td>
            </tr>`;
        }).join('');
    },

    // ==================== QUERY BUILDER ====================

    /**
     * Add a query condition
     */
    addQueryCondition() {
        const container = document.getElementById('queryConditions');
        if (!container) return;

        const conditionId = Date.now();
        const categories = TEEPQualifications.getCategories();

        const conditionHtml = `
            <div class="query-condition" data-condition-id="${conditionId}">
                <select class="condition-type" onchange="TEEPApp.updateConditionOptions(${conditionId})">
                    <option value="">Select Type...</option>
                    <option value="qualification">Has Qualification</option>
                    <option value="rank">Rank Is</option>
                    <option value="mos">MOS Is</option>
                    <option value="section">Section Is</option>
                    <option value="status">Status Is</option>
                </select>
                <select class="condition-value" disabled>
                    <option value="">Select Value...</option>
                </select>
                <select class="condition-modifier">
                    <option value="current">Must be Current</option>
                    <option value="any">Any Status</option>
                </select>
                <button class="btn btn-small btn-danger" onclick="TEEPApp.removeQueryCondition(${conditionId})">
                    Remove
                </button>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', conditionHtml);
    },

    /**
     * Update condition options based on type
     */
    async updateConditionOptions(conditionId) {
        const condition = document.querySelector(`[data-condition-id="${conditionId}"]`);
        if (!condition) return;

        const typeSelect = condition.querySelector('.condition-type');
        const valueSelect = condition.querySelector('.condition-value');
        const modifierSelect = condition.querySelector('.condition-modifier');

        const type = typeSelect.value;
        valueSelect.innerHTML = '<option value="">Select Value...</option>';
        valueSelect.disabled = !type;

        // Show/hide modifier based on type
        modifierSelect.style.display = type === 'qualification' ? 'block' : 'none';

        if (!type) return;

        let options = [];

        switch (type) {
            case 'qualification':
                const categories = TEEPQualifications.getCategories();
                categories.forEach(cat => {
                    TEEPQualifications.DEFAULT_QUAL_TYPES[cat.id].forEach(qual => {
                        options.push({ value: qual.id, label: `${cat.name}: ${qual.name}` });
                    });
                });
                break;

            case 'rank':
                TEEPQualifications.RANK_ORDER.forEach(rank => {
                    options.push({ value: rank, label: rank });
                });
                break;

            case 'mos':
                const mosValues = await TEEPStorage.getUniqueValues('mos');
                mosValues.forEach(mos => {
                    options.push({ value: mos, label: mos });
                });
                break;

            case 'section':
                const sections = await TEEPStorage.getUniqueValues('section');
                sections.forEach(section => {
                    options.push({ value: section, label: section });
                });
                break;

            case 'status':
                const statuses = ['present', 'leave', 'tad', 'deployment', 'med_hold', 'light_duty', 'legal_hold'];
                statuses.forEach(status => {
                    options.push({ value: status, label: TEEPRoster.formatStatus(status) });
                });
                break;
        }

        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            valueSelect.appendChild(option);
        });
    },

    /**
     * Remove a query condition
     */
    removeQueryCondition(conditionId) {
        const condition = document.querySelector(`[data-condition-id="${conditionId}"]`);
        if (condition) {
            condition.remove();
        }
    },

    /**
     * Execute the query
     */
    async executeQuery() {
        const conditions = document.querySelectorAll('.query-condition');
        const query = {
            qualifications: []
        };

        conditions.forEach(condition => {
            const type = condition.querySelector('.condition-type').value;
            const value = condition.querySelector('.condition-value').value;
            const modifier = condition.querySelector('.condition-modifier').value;

            if (!type || !value) return;

            switch (type) {
                case 'qualification':
                    query.qualifications.push({
                        type: value,
                        mustBeCurrent: modifier === 'current'
                    });
                    break;
                case 'rank':
                    query.rank = value;
                    break;
                case 'mos':
                    query.mos = value;
                    break;
                case 'section':
                    query.section = value;
                    break;
                case 'status':
                    query.status = value;
                    break;
            }
        });

        // Execute query
        const results = await TEEPQualifications.queryMarines(query);

        // Render results
        this.renderQueryResults(results);
    },

    /**
     * Render query results
     */
    renderQueryResults(marines) {
        const container = document.getElementById('queryResults');
        if (!container) return;

        if (marines.length === 0) {
            container.innerHTML = '<div class="no-results">No Marines match the specified criteria.</div>';
            return;
        }

        // Sort by rank then name
        marines.sort((a, b) => {
            const rankCompare = TEEPQualifications.compareRanks(a.rank, b.rank);
            if (rankCompare !== 0) return rankCompare;
            return (a.lastName || '').localeCompare(b.lastName || '');
        });

        container.innerHTML = `
            <div class="results-header">
                <span>Found ${marines.length} Marine(s)</span>
                <button class="btn btn-small btn-secondary" onclick="TEEPApp.exportQueryResults()">Export</button>
            </div>
            <table class="results-table">
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>Name</th>
                        <th>EDIPI</th>
                        <th>MOS</th>
                        <th>Section</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${marines.map(m => `
                        <tr>
                            <td>${TEEPRoster.escapeHtml(m.rank || '')}</td>
                            <td>${TEEPRoster.escapeHtml(m.lastName || '')}, ${TEEPRoster.escapeHtml(m.firstName || '')}</td>
                            <td>${TEEPRoster.escapeHtml(m.edipi || '')}</td>
                            <td>${TEEPRoster.escapeHtml(m.mos || '')}</td>
                            <td>${TEEPRoster.escapeHtml(m.section || '')}</td>
                            <td><span class="status-badge status-${m.status}">${TEEPRoster.formatStatus(m.status)}</span></td>
                            <td>
                                <button class="btn btn-small btn-secondary" onclick="TEEPRoster.viewMarine(${m.id})">View</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        // Store results for export
        this.lastQueryResults = marines;
    },

    /**
     * Clear query
     */
    clearQuery() {
        const container = document.getElementById('queryConditions');
        if (container) {
            container.innerHTML = '';
        }

        const results = document.getElementById('queryResults');
        if (results) {
            results.innerHTML = '';
        }

        this.lastQueryResults = null;
    },

    /**
     * Export query results
     */
    async exportQueryResults() {
        if (!this.lastQueryResults || this.lastQueryResults.length === 0) {
            alert('No results to export');
            return;
        }

        const data = this.lastQueryResults.map(m => ({
            Rank: m.rank,
            'Last Name': m.lastName,
            'First Name': m.firstName,
            EDIPI: m.edipi,
            MOS: m.mos,
            Section: m.section || '',
            Status: TEEPRoster.formatStatus(m.status)
        }));

        const csv = Papa.unparse(data);
        const blob = new Blob([csv], { type: 'text/csv' });
        const filename = `query_results_${new Date().toISOString().split('T')[0]}.csv`;

        TEEPReports.downloadBlob(blob, filename);
    },

    // ==================== IMPORT ====================

    /**
     * Import state
     */
    importState: {
        file: null,
        parsedData: null,
        mapping: {},
        source: null
    },

    /**
     * Handle file selection
     */
    async handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;

        this.importState.file = file;

        try {
            // Parse the file
            const parsed = await TEEPImport.parseFile(file);
            this.importState.parsedData = parsed;

            // Detect source
            this.importState.source = TEEPImport.detectSource(parsed.headers);

            // Auto-map columns
            const { mapping, unmapped } = TEEPImport.autoMapColumns(parsed.headers);
            this.importState.mapping = mapping;

            // Update UI
            this.showImportStep2();

        } catch (error) {
            alert('Error parsing file: ' + error.message);
        }
    },

    /**
     * Show import step 2 (column mapping)
     */
    showImportStep2() {
        const step1 = document.getElementById('importStep1');
        const step2 = document.getElementById('importStep2');

        if (step1) step1.style.display = 'none';
        if (step2) step2.style.display = 'block';

        // Show file info
        const fileInfo = document.getElementById('importFileInfo');
        if (fileInfo) {
            fileInfo.innerHTML = `
                <p><strong>File:</strong> ${this.importState.file.name}</p>
                <p><strong>Rows:</strong> ${this.importState.parsedData.rowCount}</p>
                ${this.importState.source ? `<p><strong>Detected Source:</strong> ${this.importState.source.name}</p>` : ''}
            `;
        }

        // Render column mapping
        this.renderColumnMapping();
    },

    /**
     * Render column mapping UI
     */
    renderColumnMapping() {
        const container = document.getElementById('columnMapping');
        if (!container) return;

        const availableFields = TEEPImport.getAvailableFields();
        const headers = this.importState.parsedData.headers;

        container.innerHTML = `
            <table class="mapping-table">
                <thead>
                    <tr>
                        <th>Source Column</th>
                        <th>Map To Field</th>
                        <th>Sample Value</th>
                    </tr>
                </thead>
                <tbody>
                    ${headers.map(header => {
                        const currentMapping = this.importState.mapping[header] || '';
                        const sampleValue = this.importState.parsedData.data[0]?.[header] || '';

                        return `
                            <tr>
                                <td>${TEEPRoster.escapeHtml(header)}</td>
                                <td>
                                    <select class="mapping-select" data-header="${header}" onchange="TEEPApp.updateMapping('${header}', this.value)">
                                        ${availableFields.map(field => `
                                            <option value="${field.value}" ${currentMapping === field.value ? 'selected' : ''}>
                                                ${field.label}${field.required ? ' *' : ''}
                                            </option>
                                        `).join('')}
                                    </select>
                                </td>
                                <td class="sample-value">${TEEPRoster.escapeHtml(String(sampleValue).substring(0, 30))}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;

        // Validate and show errors
        this.validateImportMapping();
    },

    /**
     * Update column mapping
     */
    updateMapping(header, field) {
        if (field === 'ignore' || !field) {
            delete this.importState.mapping[header];
        } else {
            this.importState.mapping[header] = field;
        }
        this.validateImportMapping();
    },

    /**
     * Validate import mapping
     */
    validateImportMapping() {
        const errors = TEEPImport.validateMapping(this.importState.mapping);
        const errorContainer = document.getElementById('mappingErrors');
        const confirmBtn = document.getElementById('confirmImportBtn');

        if (errorContainer) {
            if (errors.length > 0) {
                errorContainer.innerHTML = `
                    <div class="mapping-errors">
                        ${errors.map(e => `<p>${e}</p>`).join('')}
                    </div>
                `;
            } else {
                errorContainer.innerHTML = '';
            }
        }

        if (confirmBtn) {
            confirmBtn.disabled = errors.length > 0;
        }
    },

    /**
     * Update import type UI
     */
    updateImportTypeUI() {
        const importType = document.querySelector('input[name="importType"]:checked')?.value;
        const qualSelect = document.getElementById('importQualificationType');

        if (qualSelect) {
            qualSelect.style.display = importType === 'qualifications' ? 'block' : 'none';
        }
    },

    /**
     * Execute the import
     */
    async executeImport() {
        const importType = document.querySelector('input[name="importType"]:checked')?.value || 'marines';
        const updateExisting = document.getElementById('updateExisting')?.checked || false;

        try {
            let results;

            if (importType === 'marines') {
                results = await TEEPImport.importMarines(
                    this.importState.parsedData.data,
                    this.importState.mapping,
                    {
                        updateExisting,
                        source: this.importState.source?.id || 'file',
                        fileName: this.importState.file.name
                    }
                );
            } else {
                const qualType = document.getElementById('importQualificationType')?.value;
                if (!qualType) {
                    alert('Please select a qualification type');
                    return;
                }

                results = await TEEPImport.importQualifications(
                    this.importState.parsedData.data,
                    this.importState.mapping,
                    qualType,
                    {
                        source: this.importState.source?.id || 'file',
                        fileName: this.importState.file.name
                    }
                );
            }

            // Show results
            alert(`Import Complete!\n\nAdded: ${results.added}\nUpdated: ${results.updated}\nSkipped: ${results.skipped}\nErrors: ${results.errors.length}`);

            // Close modal and refresh
            this.closeModal('importModal');
            this.resetImport();

            // Refresh views
            await TEEPRoster.refreshRoster();
            await TEEPRoster.loadFilterOptions();
            await this.updateDashboard();

        } catch (error) {
            alert('Import failed: ' + error.message);
        }
    },

    /**
     * Reset import state
     */
    resetImport() {
        this.importState = {
            file: null,
            parsedData: null,
            mapping: {},
            source: null
        };

        // Reset UI
        const step1 = document.getElementById('importStep1');
        const step2 = document.getElementById('importStep2');
        const fileInput = document.getElementById('importFile');

        if (step1) step1.style.display = 'block';
        if (step2) step2.style.display = 'none';
        if (fileInput) fileInput.value = '';
    },

    /**
     * Handle JSON backup import
     */
    async handleJsonImport() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (!confirm('This will import data from the backup. Existing data with matching IDs may be affected. Continue?')) {
                return;
            }

            try {
                const results = await TEEPReports.importJSON(file);
                alert(`Backup Import Complete!\n\nMarines: ${results.marines.added}\nQualifications: ${results.qualifications.added}\nQualification Types: ${results.qualificationTypes.added}`);

                // Refresh everything
                await TEEPRoster.refreshRoster();
                await TEEPRoster.loadFilterOptions();
                await this.updateDashboard();
                this.closeModal('exportModal');

            } catch (error) {
                alert('Import failed: ' + error.message);
            }
        };

        input.click();
    },

    // ==================== MODALS ====================

    /**
     * Open a modal
     */
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    },

    /**
     * Close a modal
     */
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';

            // Reset import if closing import modal
            if (modalId === 'importModal') {
                this.resetImport();
            }
        }
    },

    // ==================== THEME ====================

    /**
     * Toggle theme
     */
    async toggleTheme() {
        const html = document.documentElement;
        const currentTheme = html.getAttribute('data-theme') || 'dark';

        const themes = ['dark', 'light', 'night'];
        const currentIndex = themes.indexOf(currentTheme);
        const nextTheme = themes[(currentIndex + 1) % themes.length];

        html.setAttribute('data-theme', nextTheme);
        await TEEPStorage.setSetting('theme', nextTheme);

        // Update button text
        const btn = document.getElementById('themeToggle');
        if (btn) {
            const labels = { dark: 'Dark', light: 'Light', night: 'Night' };
            btn.textContent = labels[nextTheme];
        }
    },

    /**
     * Load saved theme
     */
    async loadTheme() {
        const savedTheme = await TEEPStorage.getSetting('theme', 'dark');
        document.documentElement.setAttribute('data-theme', savedTheme);

        const btn = document.getElementById('themeToggle');
        if (btn) {
            const labels = { dark: 'Dark', light: 'Light', night: 'Night' };
            btn.textContent = labels[savedTheme] || 'Dark';
        }
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    TEEPApp.init().catch(console.error);
});
