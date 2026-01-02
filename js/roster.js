/**
 * TEEP Tracker - Roster Module
 * Handles roster display, filtering, and personnel management UI
 */

const TEEPRoster = {
    // State
    currentPage: 1,
    pageSize: 25,
    sortField: 'lastName',
    sortDirection: 'asc',
    filters: {
        status: 'all',
        section: 'all',
        rank: 'all',
        mos: 'all',
        search: ''
    },
    currentMarine: null,

    /**
     * Initialize the roster module
     */
    async init() {
        this.bindEvents();
        await this.loadFilterOptions();
        await this.refreshRoster();
    },

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Filter controls
        const filterBtn = document.getElementById('rosterFilterBtn');
        if (filterBtn) {
            filterBtn.addEventListener('click', () => this.applyFilters());
        }

        // Search input
        const searchInput = document.getElementById('rosterSearch');
        if (searchInput) {
            let debounceTimer;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.filters.search = e.target.value;
                    this.currentPage = 1;
                    this.refreshRoster();
                }, 300);
            });
        }

        // Add Marine button
        const addBtn = document.getElementById('addMarineBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.showAddMarineModal());
        }

        // Marine form
        const marineForm = document.getElementById('marineForm');
        if (marineForm) {
            marineForm.addEventListener('submit', (e) => this.handleMarineFormSubmit(e));
        }

        // Pagination controls
        document.querySelectorAll('[data-page-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.dataset.pageAction;
                this.handlePagination(action);
            });
        });

        // Page size selector
        const pageSizeSelect = document.getElementById('pageSize');
        if (pageSizeSelect) {
            pageSizeSelect.addEventListener('change', (e) => {
                this.pageSize = parseInt(e.target.value);
                this.currentPage = 1;
                this.refreshRoster();
            });
        }
    },

    /**
     * Load filter dropdown options from data
     */
    async loadFilterOptions() {
        const sections = await TEEPStorage.getUniqueValues('section');
        const ranks = await TEEPStorage.getUniqueValues('rank');
        const mosValues = await TEEPStorage.getUniqueValues('mos');

        // Populate section filter
        const sectionSelect = document.getElementById('filterSection');
        if (sectionSelect) {
            sections.forEach(section => {
                const option = document.createElement('option');
                option.value = section;
                option.textContent = section;
                sectionSelect.appendChild(option);
            });
        }

        // Populate rank filter
        const rankSelect = document.getElementById('filterRank');
        if (rankSelect) {
            const sortedRanks = ranks.sort((a, b) =>
                TEEPQualifications.compareRanks(a, b)
            );
            sortedRanks.forEach(rank => {
                const option = document.createElement('option');
                option.value = rank;
                option.textContent = rank;
                rankSelect.appendChild(option);
            });
        }

        // Populate MOS filter
        const mosSelect = document.getElementById('filterMOS');
        if (mosSelect) {
            mosValues.forEach(mos => {
                const option = document.createElement('option');
                option.value = mos;
                option.textContent = mos;
                mosSelect.appendChild(option);
            });
        }
    },

    /**
     * Apply filters from filter controls
     */
    applyFilters() {
        this.filters.status = document.getElementById('filterStatus')?.value || 'all';
        this.filters.section = document.getElementById('filterSection')?.value || 'all';
        this.filters.rank = document.getElementById('filterRank')?.value || 'all';
        this.filters.mos = document.getElementById('filterMOS')?.value || 'all';
        this.currentPage = 1;
        this.refreshRoster();
    },

    /**
     * Refresh the roster display
     */
    async refreshRoster() {
        const marines = await TEEPStorage.searchMarines(this.filters);

        // Sort
        marines.sort((a, b) => {
            let comparison = 0;

            if (this.sortField === 'rank') {
                comparison = TEEPQualifications.compareRanks(a.rank, b.rank);
            } else {
                const aVal = a[this.sortField] || '';
                const bVal = b[this.sortField] || '';
                comparison = aVal.localeCompare(bVal);
            }

            return this.sortDirection === 'asc' ? comparison : -comparison;
        });

        // Paginate
        const totalPages = Math.ceil(marines.length / this.pageSize);
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const pageMarines = marines.slice(startIndex, startIndex + this.pageSize);

        // Render
        this.renderRosterTable(pageMarines);
        this.renderPagination(marines.length, totalPages);
    },

    /**
     * Render the roster table
     */
    renderRosterTable(marines) {
        const tbody = document.querySelector('#rosterTable tbody');
        if (!tbody) return;

        if (marines.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center">
                        No Marines found. Use the Import button to add personnel.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = marines.map(marine => `
            <tr data-marine-id="${marine.id}">
                <td>${this.escapeHtml(marine.rank || '')}</td>
                <td>${this.escapeHtml(marine.lastName || '')}, ${this.escapeHtml(marine.firstName || '')} ${this.escapeHtml(marine.middleInitial || '')}</td>
                <td>${this.escapeHtml(marine.edipi || '')}</td>
                <td>${this.escapeHtml(marine.mos || '')}</td>
                <td>${this.escapeHtml(marine.section || '')}</td>
                <td>${marine.eas ? TEEPQualifications.formatDate(marine.eas) : 'N/A'}</td>
                <td><span class="status-badge status-${marine.status || 'present'}">${this.formatStatus(marine.status)}</span></td>
                <td class="actions">
                    <button class="btn btn-small btn-secondary" onclick="TEEPRoster.viewMarine(${marine.id})" title="View">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                    </button>
                    <button class="btn btn-small btn-secondary" onclick="TEEPRoster.editMarine(${marine.id})" title="Edit">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="btn btn-small btn-danger" onclick="TEEPRoster.deleteMarine(${marine.id})" title="Delete">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 6h18"></path>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </td>
            </tr>
        `).join('');
    },

    /**
     * Render pagination controls
     */
    renderPagination(totalItems, totalPages) {
        const paginationInfo = document.querySelector('.pagination-info');
        const paginationControls = document.querySelector('.pagination-controls');

        if (paginationInfo) {
            const start = (this.currentPage - 1) * this.pageSize + 1;
            const end = Math.min(this.currentPage * this.pageSize, totalItems);
            paginationInfo.textContent = `Showing ${start}-${end} of ${totalItems}`;
        }

        if (paginationControls) {
            const prevBtn = paginationControls.querySelector('[data-page-action="prev"]');
            const nextBtn = paginationControls.querySelector('[data-page-action="next"]');

            if (prevBtn) prevBtn.disabled = this.currentPage <= 1;
            if (nextBtn) nextBtn.disabled = this.currentPage >= totalPages;

            const pageIndicator = paginationControls.querySelector('.page-indicator');
            if (pageIndicator) {
                pageIndicator.textContent = `Page ${this.currentPage} of ${totalPages || 1}`;
            }
        }
    },

    /**
     * Handle pagination action
     */
    handlePagination(action) {
        if (action === 'prev' && this.currentPage > 1) {
            this.currentPage--;
            this.refreshRoster();
        } else if (action === 'next') {
            this.currentPage++;
            this.refreshRoster();
        }
    },

    /**
     * Sort by column
     */
    sortBy(field) {
        if (this.sortField === field) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortField = field;
            this.sortDirection = 'asc';
        }
        this.refreshRoster();
    },

    /**
     * Show add Marine modal
     */
    showAddMarineModal() {
        this.currentMarine = null;
        const modal = document.getElementById('marineModal');
        const form = document.getElementById('marineForm');
        const title = document.getElementById('marineModalTitle');

        if (form) form.reset();
        if (title) title.textContent = 'Add Marine';

        // Set default status
        const statusSelect = document.getElementById('marineStatus');
        if (statusSelect) statusSelect.value = 'present';

        TEEPApp.openModal('marineModal');
    },

    /**
     * Edit a Marine
     */
    async editMarine(id) {
        const marine = await TEEPStorage.getMarine(id);
        if (!marine) {
            alert('Marine not found');
            return;
        }

        this.currentMarine = marine;
        const title = document.getElementById('marineModalTitle');
        if (title) title.textContent = 'Edit Marine';

        // Populate form
        document.getElementById('marineLastName').value = marine.lastName || '';
        document.getElementById('marineFirstName').value = marine.firstName || '';
        document.getElementById('marineMiddleInitial').value = marine.middleInitial || '';
        document.getElementById('marineEdipi').value = marine.edipi || '';
        document.getElementById('marineRank').value = marine.rank || '';
        document.getElementById('marineMOS').value = marine.mos || '';
        document.getElementById('marineSection').value = marine.section || '';
        document.getElementById('marineBillet').value = marine.billet || '';
        document.getElementById('marineEAS').value = marine.eas || '';
        document.getElementById('marinePEBD').value = marine.pebd || '';
        document.getElementById('marineDOR').value = marine.dor || '';
        document.getElementById('marineStatus').value = marine.status || 'present';
        document.getElementById('marinePhone').value = marine.phone || '';
        document.getElementById('marineEmail').value = marine.email || '';
        document.getElementById('marineNotes').value = marine.notes || '';

        TEEPApp.openModal('marineModal');
    },

    /**
     * Handle Marine form submission
     */
    async handleMarineFormSubmit(e) {
        e.preventDefault();

        const marine = {
            lastName: document.getElementById('marineLastName').value.trim(),
            firstName: document.getElementById('marineFirstName').value.trim(),
            middleInitial: document.getElementById('marineMiddleInitial').value.trim(),
            edipi: document.getElementById('marineEdipi').value.trim(),
            rank: TEEPQualifications.normalizeRank(document.getElementById('marineRank').value.trim()),
            mos: document.getElementById('marineMOS').value.trim(),
            section: document.getElementById('marineSection').value.trim(),
            billet: document.getElementById('marineBillet').value.trim(),
            eas: document.getElementById('marineEAS').value || null,
            pebd: document.getElementById('marinePEBD').value || null,
            dor: document.getElementById('marineDOR').value || null,
            status: document.getElementById('marineStatus').value,
            phone: document.getElementById('marinePhone').value.trim(),
            email: document.getElementById('marineEmail').value.trim(),
            notes: document.getElementById('marineNotes').value.trim()
        };

        // Validate required fields
        if (!marine.lastName || !marine.firstName) {
            alert('Last Name and First Name are required');
            return;
        }

        if (!marine.edipi) {
            alert('EDIPI is required');
            return;
        }

        try {
            if (this.currentMarine) {
                // Update existing
                marine.id = this.currentMarine.id;
                marine.createdAt = this.currentMarine.createdAt;
                await TEEPStorage.updateMarine(marine);
            } else {
                // Add new
                await TEEPStorage.addMarine(marine);
            }

            TEEPApp.closeModal('marineModal');
            await this.refreshRoster();
            await this.loadFilterOptions(); // Refresh filter options

            // Update dashboard stats
            if (typeof TEEPApp !== 'undefined' && TEEPApp.updateDashboard) {
                TEEPApp.updateDashboard();
            }

        } catch (error) {
            alert('Error saving Marine: ' + error.message);
        }
    },

    /**
     * View Marine details
     */
    async viewMarine(id) {
        const marine = await TEEPStorage.getMarine(id);
        if (!marine) {
            alert('Marine not found');
            return;
        }

        const qualifications = await TEEPStorage.getQualificationsByMarine(id);

        // Populate view modal
        const content = document.getElementById('viewMarineContent');
        if (content) {
            content.innerHTML = this.renderMarineDetails(marine, qualifications);
        }

        // Store current marine ID for add qualification button
        this.currentMarine = marine;

        TEEPApp.openModal('viewMarineModal');
    },

    /**
     * Render Marine details HTML
     */
    renderMarineDetails(marine, qualifications) {
        // Group qualifications by category
        const qualsByCategory = {};
        qualifications.forEach(qual => {
            const qualType = TEEPQualifications.getQualificationType(qual.type);
            const category = qualType ? qualType.category : 'other';
            if (!qualsByCategory[category]) {
                qualsByCategory[category] = [];
            }
            qualsByCategory[category].push({ ...qual, qualType });
        });

        return `
            <div class="marine-details">
                <div class="marine-header">
                    <h3>${this.escapeHtml(marine.rank)} ${this.escapeHtml(marine.lastName)}, ${this.escapeHtml(marine.firstName)} ${this.escapeHtml(marine.middleInitial || '')}</h3>
                    <span class="status-badge status-${marine.status}">${this.formatStatus(marine.status)}</span>
                </div>

                <div class="details-grid">
                    <div class="detail-item">
                        <label>EDIPI</label>
                        <span>${this.escapeHtml(marine.edipi || 'N/A')}</span>
                    </div>
                    <div class="detail-item">
                        <label>MOS</label>
                        <span>${this.escapeHtml(marine.mos || 'N/A')}</span>
                    </div>
                    <div class="detail-item">
                        <label>Section</label>
                        <span>${this.escapeHtml(marine.section || 'N/A')}</span>
                    </div>
                    <div class="detail-item">
                        <label>Billet</label>
                        <span>${this.escapeHtml(marine.billet || 'N/A')}</span>
                    </div>
                    <div class="detail-item">
                        <label>EAS</label>
                        <span>${marine.eas ? TEEPQualifications.formatDate(marine.eas) : 'N/A'}</span>
                    </div>
                    <div class="detail-item">
                        <label>PEBD</label>
                        <span>${marine.pebd ? TEEPQualifications.formatDate(marine.pebd) : 'N/A'}</span>
                    </div>
                </div>

                <div class="qualifications-section">
                    <div class="section-header">
                        <h4>Qualifications</h4>
                        <button class="btn btn-small btn-primary" onclick="TEEPRoster.showAddQualificationModal(${marine.id})">
                            Add Qualification
                        </button>
                    </div>

                    ${Object.keys(qualsByCategory).length === 0 ? `
                        <p class="no-quals">No qualifications recorded</p>
                    ` : Object.entries(qualsByCategory).map(([category, quals]) => `
                        <div class="qual-category">
                            <h5>${TEEPQualifications.formatCategoryName(category)}</h5>
                            <table class="quals-table">
                                <thead>
                                    <tr>
                                        <th>Qualification</th>
                                        <th>Completed</th>
                                        <th>Expires</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${quals.map(qual => {
                                        const status = TEEPQualifications.getQualificationStatus(qual);
                                        return `
                                            <tr>
                                                <td>${this.escapeHtml(qual.qualType?.name || qual.type)}</td>
                                                <td>${TEEPQualifications.formatDate(qual.completionDate)}</td>
                                                <td>${qual.expirationDate ? TEEPQualifications.formatDate(qual.expirationDate) : 'Never'}</td>
                                                <td><span class="status-badge ${status.class}">${status.label}</span></td>
                                                <td>
                                                    <button class="btn btn-small btn-danger" onclick="TEEPRoster.deleteQualification(${qual.id}, ${marine.id})">
                                                        Delete
                                                    </button>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    /**
     * Show add qualification modal
     */
    showAddQualificationModal(marineId) {
        // Populate qualification type dropdown
        const select = document.getElementById('qualificationType');
        if (select) {
            select.innerHTML = '<option value="">Select Qualification...</option>';

            const categories = TEEPQualifications.getCategories();
            categories.forEach(category => {
                const optgroup = document.createElement('optgroup');
                optgroup.label = category.name;

                TEEPQualifications.DEFAULT_QUAL_TYPES[category.id].forEach(qual => {
                    const option = document.createElement('option');
                    option.value = qual.id;
                    option.textContent = qual.name;
                    optgroup.appendChild(option);
                });

                select.appendChild(optgroup);
            });
        }

        // Set default date to today
        const dateInput = document.getElementById('qualificationDate');
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }

        // Store marine ID
        document.getElementById('qualificationMarineId').value = marineId;

        // Reset score field
        const scoreInput = document.getElementById('qualificationScore');
        if (scoreInput) scoreInput.value = '';

        TEEPApp.openModal('qualificationModal');
    },

    /**
     * Handle qualification form submission
     */
    async handleQualificationSubmit(e) {
        e.preventDefault();

        const marineId = parseInt(document.getElementById('qualificationMarineId').value);
        const qualType = document.getElementById('qualificationType').value;
        const completionDate = document.getElementById('qualificationDate').value;
        const score = document.getElementById('qualificationScore').value;

        if (!qualType || !completionDate) {
            alert('Please select a qualification type and completion date');
            return;
        }

        const marine = await TEEPStorage.getMarine(marineId);
        if (!marine) {
            alert('Marine not found');
            return;
        }

        const qualTypeObj = TEEPQualifications.getQualificationType(qualType);

        const qualification = {
            marineId: marineId,
            type: qualType,
            completionDate: completionDate,
            expirationDate: qualTypeObj ?
                TEEPQualifications.calculateExpiration(qualTypeObj, completionDate, marine.eas) :
                null,
            score: score ? parseInt(score) : null,
            source: 'manual'
        };

        try {
            await TEEPStorage.addQualification(qualification);
            TEEPApp.closeModal('qualificationModal');

            // Refresh the view
            await this.viewMarine(marineId);

            // Update dashboard
            if (typeof TEEPApp !== 'undefined' && TEEPApp.updateDashboard) {
                TEEPApp.updateDashboard();
            }
        } catch (error) {
            alert('Error adding qualification: ' + error.message);
        }
    },

    /**
     * Delete a qualification
     */
    async deleteQualification(qualId, marineId) {
        if (!confirm('Are you sure you want to delete this qualification?')) {
            return;
        }

        try {
            await TEEPStorage.deleteQualification(qualId);
            await this.viewMarine(marineId);

            // Update dashboard
            if (typeof TEEPApp !== 'undefined' && TEEPApp.updateDashboard) {
                TEEPApp.updateDashboard();
            }
        } catch (error) {
            alert('Error deleting qualification: ' + error.message);
        }
    },

    /**
     * Delete a Marine
     */
    async deleteMarine(id) {
        const marine = await TEEPStorage.getMarine(id);
        if (!marine) return;

        const name = `${marine.rank} ${marine.lastName}, ${marine.firstName}`;
        if (!confirm(`Are you sure you want to delete ${name}? This will also delete all their qualifications.`)) {
            return;
        }

        try {
            await TEEPStorage.deleteMarine(id);
            await this.refreshRoster();

            // Update dashboard
            if (typeof TEEPApp !== 'undefined' && TEEPApp.updateDashboard) {
                TEEPApp.updateDashboard();
            }
        } catch (error) {
            alert('Error deleting Marine: ' + error.message);
        }
    },

    /**
     * Format status for display
     */
    formatStatus(status) {
        const statusLabels = {
            present: 'Present',
            leave: 'Leave',
            tad: 'TAD',
            deployment: 'Deployed',
            med_hold: 'Med Hold',
            light_duty: 'Light Duty',
            legal_hold: 'Legal Hold'
        };
        return statusLabels[status] || status || 'Unknown';
    },

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};
