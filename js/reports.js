/**
 * TEEP Tracker - Reports Module
 * Handles report generation and exports (PDF, CSV)
 */

const TEEPReports = {
    /**
     * Report types
     */
    REPORT_TYPES: {
        full_roster: {
            id: 'full_roster',
            name: 'Full Roster Report',
            description: 'Complete list of all personnel with basic info'
        },
        training_matrix: {
            id: 'training_matrix',
            name: 'Training Matrix',
            description: 'All Marines with their qualification status'
        },
        license_roster: {
            id: 'license_roster',
            name: 'License Roster',
            description: 'All licensed operators and expiration dates'
        },
        expiring_quals: {
            id: 'expiring_quals',
            name: 'Expiring Qualifications',
            description: 'Qualifications expiring in next 30/60/90 days'
        },
        pft_cft_tracker: {
            id: 'pft_cft_tracker',
            name: 'PFT/CFT Tracker',
            description: 'Physical fitness test status and scores'
        },
        annual_training: {
            id: 'annual_training',
            name: 'Annual Training Status',
            description: 'FY annual training completion status'
        }
    },

    /**
     * Generate a report
     */
    async generateReport(reportType, options = {}) {
        switch (reportType) {
            case 'full_roster':
                return this.generateFullRoster(options);
            case 'training_matrix':
                return this.generateTrainingMatrix(options);
            case 'license_roster':
                return this.generateLicenseRoster(options);
            case 'expiring_quals':
                return this.generateExpiringQuals(options);
            case 'pft_cft_tracker':
                return this.generatePftCftTracker(options);
            case 'annual_training':
                return this.generateAnnualTraining(options);
            default:
                throw new Error('Unknown report type: ' + reportType);
        }
    },

    /**
     * Generate Full Roster Report
     */
    async generateFullRoster(options = {}) {
        const marines = await TEEPStorage.getAllMarines();

        // Sort by rank then name
        marines.sort((a, b) => {
            const rankCompare = TEEPQualifications.compareRanks(a.rank, b.rank);
            if (rankCompare !== 0) return rankCompare;
            return (a.lastName || '').localeCompare(b.lastName || '');
        });

        const data = marines.map(m => ({
            Rank: m.rank,
            'Last Name': m.lastName,
            'First Name': m.firstName,
            MI: m.middleInitial || '',
            EDIPI: m.edipi,
            MOS: m.mos,
            Section: m.section || '',
            Billet: m.billet || '',
            EAS: m.eas ? TEEPQualifications.formatDate(m.eas) : '',
            Status: TEEPRoster.formatStatus(m.status)
        }));

        return {
            title: 'Full Roster Report',
            generated: new Date().toISOString(),
            recordCount: data.length,
            columns: ['Rank', 'Last Name', 'First Name', 'MI', 'EDIPI', 'MOS', 'Section', 'Billet', 'EAS', 'Status'],
            data: data
        };
    },

    /**
     * Generate Training Matrix
     */
    async generateTrainingMatrix(options = {}) {
        const marines = await TEEPStorage.getAllMarines();
        const allQuals = await TEEPStorage.getAllQualifications();

        // Get key qualification types to track
        const keyQuals = ['pft', 'cft', 'rifle_qual', 'annual_training', 'cyber_awareness', 'pha'];

        // Sort marines
        marines.sort((a, b) => {
            const rankCompare = TEEPQualifications.compareRanks(a.rank, b.rank);
            if (rankCompare !== 0) return rankCompare;
            return (a.lastName || '').localeCompare(b.lastName || '');
        });

        const data = marines.map(m => {
            const marineQuals = allQuals.filter(q => q.marineId === m.id);
            const row = {
                Rank: m.rank,
                Name: `${m.lastName}, ${m.firstName}`,
                Section: m.section || ''
            };

            // Add each qualification status
            keyQuals.forEach(qualType => {
                const qual = marineQuals.find(q => q.type === qualType);
                if (qual) {
                    const status = TEEPQualifications.getQualificationStatus(qual);
                    row[this.getQualLabel(qualType)] = status.status === 'current' ? 'Current' :
                        status.status === 'expired' ? 'EXPIRED' : status.label;
                } else {
                    row[this.getQualLabel(qualType)] = 'N/A';
                }
            });

            return row;
        });

        const columns = ['Rank', 'Name', 'Section', ...keyQuals.map(q => this.getQualLabel(q))];

        return {
            title: 'Training Matrix',
            generated: new Date().toISOString(),
            recordCount: data.length,
            columns: columns,
            data: data
        };
    },

    /**
     * Generate License Roster
     */
    async generateLicenseRoster(options = {}) {
        const marines = await TEEPStorage.getAllMarines();
        const allQuals = await TEEPStorage.getAllQualifications();

        const licenseTypes = ['license_hmmwv', 'license_7ton', 'license_forklift', 'license_lav'];
        const data = [];

        marines.forEach(m => {
            const marineQuals = allQuals.filter(q =>
                q.marineId === m.id && licenseTypes.includes(q.type)
            );

            marineQuals.forEach(qual => {
                const qualType = TEEPQualifications.getQualificationType(qual.type);
                const status = TEEPQualifications.getQualificationStatus(qual);

                data.push({
                    Rank: m.rank,
                    Name: `${m.lastName}, ${m.firstName}`,
                    Section: m.section || '',
                    License: qualType?.name || qual.type,
                    'Issue Date': TEEPQualifications.formatDate(qual.completionDate),
                    'Expiration': qual.expirationDate ? TEEPQualifications.formatDate(qual.expirationDate) : 'N/A',
                    Status: status.label,
                    EAS: m.eas ? TEEPQualifications.formatDate(m.eas) : ''
                });
            });
        });

        // Sort by status (expired first), then name
        data.sort((a, b) => {
            if (a.Status === 'Expired' && b.Status !== 'Expired') return -1;
            if (a.Status !== 'Expired' && b.Status === 'Expired') return 1;
            return a.Name.localeCompare(b.Name);
        });

        return {
            title: 'License Roster',
            generated: new Date().toISOString(),
            recordCount: data.length,
            columns: ['Rank', 'Name', 'Section', 'License', 'Issue Date', 'Expiration', 'Status', 'EAS'],
            data: data
        };
    },

    /**
     * Generate Expiring Qualifications Report
     */
    async generateExpiringQuals(options = {}) {
        const days = options.days || 90;
        const marines = await TEEPStorage.getAllMarines();
        const marineMap = new Map(marines.map(m => [m.id, m]));

        // Get overdue and expiring
        const overdue = await TEEPStorage.getOverdueQualifications();
        const expiring = await TEEPStorage.getExpiringQualifications(days);

        const allQuals = [...overdue, ...expiring];
        const data = [];

        allQuals.forEach(qual => {
            const marine = marineMap.get(qual.marineId);
            if (!marine) return;

            const qualType = TEEPQualifications.getQualificationType(qual.type);
            const status = TEEPQualifications.getQualificationStatus(qual);
            const daysUntil = TEEPQualifications.daysUntilExpiration(qual.expirationDate);

            data.push({
                Rank: marine.rank,
                Name: `${marine.lastName}, ${marine.firstName}`,
                Section: marine.section || '',
                Qualification: qualType?.name || qual.type,
                'Completed': TEEPQualifications.formatDate(qual.completionDate),
                'Expires': TEEPQualifications.formatDate(qual.expirationDate),
                'Days': daysUntil,
                Status: status.label
            });
        });

        // Sort by days until expiration (most urgent first)
        data.sort((a, b) => a.Days - b.Days);

        return {
            title: `Expiring Qualifications (Next ${days} Days)`,
            generated: new Date().toISOString(),
            recordCount: data.length,
            columns: ['Rank', 'Name', 'Section', 'Qualification', 'Completed', 'Expires', 'Days', 'Status'],
            data: data
        };
    },

    /**
     * Generate PFT/CFT Tracker
     */
    async generatePftCftTracker(options = {}) {
        const marines = await TEEPStorage.getAllMarines();
        const allQuals = await TEEPStorage.getAllQualifications();

        marines.sort((a, b) => {
            const rankCompare = TEEPQualifications.compareRanks(a.rank, b.rank);
            if (rankCompare !== 0) return rankCompare;
            return (a.lastName || '').localeCompare(b.lastName || '');
        });

        const data = marines.map(m => {
            const marineQuals = allQuals.filter(q => q.marineId === m.id);

            const pft = marineQuals.find(q => q.type === 'pft');
            const cft = marineQuals.find(q => q.type === 'cft');
            const bca = marineQuals.find(q => q.type === 'bca');

            const pftStatus = pft ? TEEPQualifications.getQualificationStatus(pft) : null;
            const cftStatus = cft ? TEEPQualifications.getQualificationStatus(cft) : null;
            const bcaStatus = bca ? TEEPQualifications.getQualificationStatus(bca) : null;

            return {
                Rank: m.rank,
                Name: `${m.lastName}, ${m.firstName}`,
                Section: m.section || '',
                'PFT Date': pft ? TEEPQualifications.formatDate(pft.completionDate) : 'N/A',
                'PFT Score': pft?.score || 'N/A',
                'PFT Status': pftStatus?.label || 'Missing',
                'CFT Date': cft ? TEEPQualifications.formatDate(cft.completionDate) : 'N/A',
                'CFT Score': cft?.score || 'N/A',
                'CFT Status': cftStatus?.label || 'Missing',
                'BCA Status': bcaStatus?.label || 'Missing'
            };
        });

        return {
            title: 'PFT/CFT Tracker',
            generated: new Date().toISOString(),
            recordCount: data.length,
            columns: ['Rank', 'Name', 'Section', 'PFT Date', 'PFT Score', 'PFT Status', 'CFT Date', 'CFT Score', 'CFT Status', 'BCA Status'],
            data: data
        };
    },

    /**
     * Generate Annual Training Status
     */
    async generateAnnualTraining(options = {}) {
        const marines = await TEEPStorage.getAllMarines();
        const allQuals = await TEEPStorage.getAllQualifications();
        const currentFY = TEEPQualifications.getCurrentFiscalYear();

        const trainingTypes = ['annual_training', 'cyber_awareness', 'sharp', 'suicide_prevention'];

        marines.sort((a, b) => {
            const rankCompare = TEEPQualifications.compareRanks(a.rank, b.rank);
            if (rankCompare !== 0) return rankCompare;
            return (a.lastName || '').localeCompare(b.lastName || '');
        });

        const data = marines.map(m => {
            const marineQuals = allQuals.filter(q => q.marineId === m.id);
            const row = {
                Rank: m.rank,
                Name: `${m.lastName}, ${m.firstName}`,
                Section: m.section || ''
            };

            let completedCount = 0;

            trainingTypes.forEach(qualType => {
                const qual = marineQuals.find(q => q.type === qualType);
                const qualTypeInfo = TEEPQualifications.getQualificationType(qualType);
                const label = qualTypeInfo?.name || qualType;

                if (qual) {
                    const status = TEEPQualifications.getQualificationStatus(qual);
                    row[label] = status.status === 'current' ? 'Complete' : status.label;
                    if (status.status === 'current') completedCount++;
                } else {
                    row[label] = 'Incomplete';
                }
            });

            row['Completion'] = `${completedCount}/${trainingTypes.length}`;

            return row;
        });

        const columns = ['Rank', 'Name', 'Section', ...trainingTypes.map(t => {
            const info = TEEPQualifications.getQualificationType(t);
            return info?.name || t;
        }), 'Completion'];

        return {
            title: `FY${currentFY} Annual Training Status`,
            generated: new Date().toISOString(),
            recordCount: data.length,
            columns: columns,
            data: data
        };
    },

    /**
     * Get qualification label
     */
    getQualLabel(qualType) {
        const info = TEEPQualifications.getQualificationType(qualType);
        return info?.name || qualType;
    },

    /**
     * Export report as CSV
     */
    exportCSV(report) {
        if (!report.data || report.data.length === 0) {
            alert('No data to export');
            return;
        }

        const csvContent = Papa.unparse(report.data, {
            columns: report.columns
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const filename = `${report.title.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.csv`;

        this.downloadBlob(blob, filename);
    },

    /**
     * Export report as PDF
     */
    exportPDF(report) {
        if (!report.data || report.data.length === 0) {
            alert('No data to export');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: report.columns.length > 6 ? 'landscape' : 'portrait',
            unit: 'mm',
            format: 'letter'
        });

        // Header
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(report.title, 14, 15);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);
        doc.text(`Records: ${report.recordCount}`, 14, 28);

        // Table
        const tableData = report.data.map(row =>
            report.columns.map(col => String(row[col] ?? ''))
        );

        doc.autoTable({
            head: [report.columns],
            body: tableData,
            startY: 35,
            styles: {
                fontSize: 8,
                cellPadding: 2
            },
            headStyles: {
                fillColor: [196, 30, 58], // USMC Scarlet
                textColor: 255,
                fontStyle: 'bold'
            },
            alternateRowStyles: {
                fillColor: [245, 245, 245]
            },
            margin: { top: 35, left: 14, right: 14 }
        });

        // Footer
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.text(
                `Page ${i} of ${pageCount} - TEEP Tracker`,
                doc.internal.pageSize.width / 2,
                doc.internal.pageSize.height - 10,
                { align: 'center' }
            );
        }

        const filename = `${report.title.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(filename);
    },

    /**
     * Export all data as JSON backup
     */
    async exportJSON() {
        const backup = await TEEPStorage.exportAllData();
        const jsonContent = JSON.stringify(backup, null, 2);
        const blob = new Blob([jsonContent], { type: 'application/json' });
        const filename = `teep-tracker-backup_${new Date().toISOString().split('T')[0]}.json`;

        this.downloadBlob(blob, filename);
    },

    /**
     * Helper to download a blob
     */
    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    /**
     * Import from JSON backup
     */
    async importJSON(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = async (e) => {
                try {
                    const backup = JSON.parse(e.target.result);

                    if (!backup.data) {
                        reject(new Error('Invalid backup file format'));
                        return;
                    }

                    const results = await TEEPStorage.importFromBackup(backup);
                    resolve(results);
                } catch (error) {
                    reject(new Error('Failed to parse backup file: ' + error.message));
                }
            };

            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };

            reader.readAsText(file);
        });
    },

    /**
     * Render reports list
     */
    renderReportsList() {
        const container = document.querySelector('.reports-grid');
        if (!container) return;

        container.innerHTML = Object.values(this.REPORT_TYPES).map(report => `
            <div class="report-card" data-report="${report.id}">
                <h3>${report.name}</h3>
                <p>${report.description}</p>
                <div class="report-actions">
                    <button class="btn btn-primary btn-small" onclick="TEEPReports.previewReport('${report.id}')">
                        Preview
                    </button>
                    <button class="btn btn-secondary btn-small" onclick="TEEPReports.quickExportCSV('${report.id}')">
                        CSV
                    </button>
                    <button class="btn btn-secondary btn-small" onclick="TEEPReports.quickExportPDF('${report.id}')">
                        PDF
                    </button>
                </div>
            </div>
        `).join('');
    },

    /**
     * Preview a report
     */
    async previewReport(reportType) {
        const report = await this.generateReport(reportType);

        const previewContainer = document.getElementById('reportPreview');
        if (!previewContainer) return;

        previewContainer.innerHTML = `
            <div class="report-preview">
                <div class="report-header">
                    <h3>${report.title}</h3>
                    <div class="report-meta">
                        <span>Generated: ${new Date(report.generated).toLocaleString()}</span>
                        <span>Records: ${report.recordCount}</span>
                    </div>
                    <div class="report-export-buttons">
                        <button class="btn btn-primary" onclick="TEEPReports.quickExportCSV('${reportType}')">Export CSV</button>
                        <button class="btn btn-secondary" onclick="TEEPReports.quickExportPDF('${reportType}')">Export PDF</button>
                    </div>
                </div>
                <div class="report-table-container">
                    <table class="report-table">
                        <thead>
                            <tr>${report.columns.map(col => `<th>${col}</th>`).join('')}</tr>
                        </thead>
                        <tbody>
                            ${report.data.slice(0, 50).map(row => `
                                <tr>${report.columns.map(col => `<td>${this.escapeHtml(String(row[col] ?? ''))}</td>`).join('')}</tr>
                            `).join('')}
                            ${report.data.length > 50 ? `
                                <tr><td colspan="${report.columns.length}" class="text-center">
                                    ... and ${report.data.length - 50} more records (export to see all)
                                </td></tr>
                            ` : ''}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    /**
     * Quick export to CSV
     */
    async quickExportCSV(reportType) {
        const report = await this.generateReport(reportType);
        this.exportCSV(report);
    },

    /**
     * Quick export to PDF
     */
    async quickExportPDF(reportType) {
        const report = await this.generateReport(reportType);
        this.exportPDF(report);
    },

    /**
     * Escape HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};
