/**
 * TEEP Tracker - Import Module
 * Handles CSV/Excel import with intelligent column mapping
 */

const TEEPImport = {
    /**
     * Column mapping definitions with common variations
     */
    COLUMN_MAPPINGS: {
        // Personal Info
        lastName: {
            field: 'lastName',
            label: 'Last Name',
            required: true,
            patterns: [
                /^last[\s_-]?name$/i,
                /^lname$/i,
                /^surname$/i,
                /^family[\s_-]?name$/i,
                /^name[\s_-]?last$/i
            ]
        },
        firstName: {
            field: 'firstName',
            label: 'First Name',
            required: true,
            patterns: [
                /^first[\s_-]?name$/i,
                /^fname$/i,
                /^given[\s_-]?name$/i,
                /^name[\s_-]?first$/i
            ]
        },
        middleInitial: {
            field: 'middleInitial',
            label: 'Middle Initial',
            required: false,
            patterns: [
                /^middle[\s_-]?initial$/i,
                /^mi$/i,
                /^middle[\s_-]?name$/i,
                /^mname$/i
            ]
        },
        edipi: {
            field: 'edipi',
            label: 'EDIPI/DoD ID',
            required: true,
            patterns: [
                /^edipi$/i,
                /^dod[\s_-]?id$/i,
                /^dodid$/i,
                /^ssn$/i,
                /^member[\s_-]?id$/i,
                /^id[\s_-]?number$/i
            ]
        },
        rank: {
            field: 'rank',
            label: 'Rank',
            required: true,
            patterns: [
                /^rank$/i,
                /^grade$/i,
                /^pay[\s_-]?grade$/i,
                /^paygrade$/i
            ],
            transform: (value) => TEEPQualifications.normalizeRank(value)
        },
        mos: {
            field: 'mos',
            label: 'MOS',
            required: true,
            patterns: [
                /^mos$/i,
                /^pmos$/i,
                /^primary[\s_-]?mos$/i,
                /^occ[\s_-]?field$/i,
                /^occupational[\s_-]?field$/i,
                /^job$/i
            ]
        },

        // Dates
        eas: {
            field: 'eas',
            label: 'EAS',
            required: false,
            patterns: [
                /^eas$/i,
                /^exp[\s_-]?active[\s_-]?service$/i,
                /^separation[\s_-]?date$/i,
                /^eaos$/i
            ],
            transform: (value) => TEEPImport.parseDate(value)
        },
        pebd: {
            field: 'pebd',
            label: 'PEBD',
            required: false,
            patterns: [
                /^pebd$/i,
                /^pay[\s_-]?entry[\s_-]?base[\s_-]?date$/i,
                /^entry[\s_-]?date$/i
            ],
            transform: (value) => TEEPImport.parseDate(value)
        },
        dor: {
            field: 'dor',
            label: 'Date of Rank',
            required: false,
            patterns: [
                /^dor$/i,
                /^date[\s_-]?of[\s_-]?rank$/i,
                /^rank[\s_-]?date$/i
            ],
            transform: (value) => TEEPImport.parseDate(value)
        },

        // Unit Info
        section: {
            field: 'section',
            label: 'Section/Platoon',
            required: false,
            patterns: [
                /^section$/i,
                /^platoon$/i,
                /^plt$/i,
                /^squad$/i,
                /^team$/i,
                /^shop$/i,
                /^department$/i,
                /^dept$/i
            ]
        },
        billet: {
            field: 'billet',
            label: 'Billet',
            required: false,
            patterns: [
                /^billet$/i,
                /^position$/i,
                /^duty$/i,
                /^assignment$/i,
                /^job[\s_-]?title$/i
            ]
        },

        // Contact
        phone: {
            field: 'phone',
            label: 'Phone Number',
            required: false,
            patterns: [
                /^phone$/i,
                /^telephone$/i,
                /^cell$/i,
                /^mobile$/i,
                /^contact[\s_-]?number$/i
            ]
        },
        email: {
            field: 'email',
            label: 'Email',
            required: false,
            patterns: [
                /^email$/i,
                /^e[\s_-]?mail$/i,
                /^mail$/i
            ]
        }
    },

    /**
     * Known import sources with specific parsing rules
     */
    IMPORT_SOURCES: {
        mol: {
            name: 'MOL (Marine Online)',
            detectPatterns: ['EDIPI', 'GRADE', 'PMOS'],
            columnMap: {
                'EDIPI': 'edipi',
                'LAST NAME': 'lastName',
                'FIRST NAME': 'firstName',
                'MI': 'middleInitial',
                'GRADE': 'rank',
                'PMOS': 'mos',
                'EAS': 'eas'
            }
        },
        mctims: {
            name: 'MCTIMS',
            detectPatterns: ['Member ID', 'Completion Date', 'Course'],
            columnMap: {
                'Member ID': 'edipi',
                'Last Name': 'lastName',
                'First Name': 'firstName',
                'Rank': 'rank'
            }
        },
        marinenet: {
            name: 'MarineNet',
            detectPatterns: ['Student Name', 'Course Title', 'Completion'],
            columnMap: {
                'DoD ID': 'edipi',
                'Student Name': 'fullName', // Needs parsing
                'Rank': 'rank'
            }
        }
    },

    /**
     * Parse a file (CSV or Excel)
     */
    async parseFile(file) {
        const fileName = file.name.toLowerCase();

        if (fileName.endsWith('.csv') || fileName.endsWith('.txt')) {
            return this.parseCSV(file);
        } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
            return this.parseExcel(file);
        } else {
            throw new Error('Unsupported file format. Please use CSV or Excel files.');
        }
    },

    /**
     * Parse CSV file using PapaParse
     */
    async parseCSV(file) {
        return new Promise((resolve, reject) => {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                transformHeader: (header) => header.trim(),
                complete: (results) => {
                    if (results.errors.length > 0) {
                        console.warn('CSV parsing warnings:', results.errors);
                    }
                    resolve({
                        headers: results.meta.fields,
                        data: results.data,
                        rowCount: results.data.length
                    });
                },
                error: (error) => {
                    reject(new Error(`CSV parsing failed: ${error.message}`));
                }
            });
        });
    },

    /**
     * Parse Excel file using SheetJS
     */
    async parseExcel(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array', cellDates: true });

                    // Use first sheet
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];

                    // Convert to JSON with headers
                    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                    if (jsonData.length < 2) {
                        reject(new Error('Excel file must have headers and at least one data row'));
                        return;
                    }

                    const headers = jsonData[0].map(h => String(h || '').trim());
                    const rows = jsonData.slice(1).map(row => {
                        const obj = {};
                        headers.forEach((header, i) => {
                            obj[header] = row[i];
                        });
                        return obj;
                    }).filter(row => {
                        // Filter out empty rows
                        return Object.values(row).some(v => v !== undefined && v !== '');
                    });

                    resolve({
                        headers: headers,
                        data: rows,
                        rowCount: rows.length,
                        sheetName: sheetName
                    });
                } catch (error) {
                    reject(new Error(`Excel parsing failed: ${error.message}`));
                }
            };

            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };

            reader.readAsArrayBuffer(file);
        });
    },

    /**
     * Detect import source based on headers
     */
    detectSource(headers) {
        for (const [sourceId, source] of Object.entries(this.IMPORT_SOURCES)) {
            const matchCount = source.detectPatterns.filter(pattern =>
                headers.some(h => h.includes(pattern))
            ).length;

            if (matchCount >= source.detectPatterns.length * 0.6) {
                return { id: sourceId, ...source };
            }
        }
        return null;
    },

    /**
     * Auto-map columns based on patterns
     */
    autoMapColumns(headers) {
        const mapping = {};
        const unmapped = [];

        for (const header of headers) {
            let matched = false;

            for (const [fieldId, fieldDef] of Object.entries(this.COLUMN_MAPPINGS)) {
                // Check if any pattern matches
                if (fieldDef.patterns.some(pattern => pattern.test(header))) {
                    mapping[header] = fieldId;
                    matched = true;
                    break;
                }
            }

            if (!matched) {
                unmapped.push(header);
            }
        }

        return { mapping, unmapped };
    },

    /**
     * Validate column mapping
     */
    validateMapping(mapping) {
        const errors = [];
        const mapped = new Set(Object.values(mapping));

        // Check required fields
        for (const [fieldId, fieldDef] of Object.entries(this.COLUMN_MAPPINGS)) {
            if (fieldDef.required && !mapped.has(fieldId)) {
                errors.push(`Required field "${fieldDef.label}" is not mapped`);
            }
        }

        // Check for EDIPI or name combination
        if (!mapped.has('edipi') && !(mapped.has('lastName') && mapped.has('firstName'))) {
            errors.push('Either EDIPI or First Name + Last Name is required for identification');
        }

        return errors;
    },

    /**
     * Parse various date formats
     */
    parseDate(value) {
        if (!value) return null;

        // If already a Date object
        if (value instanceof Date) {
            return value.toISOString().split('T')[0];
        }

        // Handle Excel serial dates
        if (typeof value === 'number') {
            const date = new Date((value - 25569) * 86400 * 1000);
            return date.toISOString().split('T')[0];
        }

        const str = String(value).trim();

        // Common date formats
        const formats = [
            // ISO: 2024-01-15
            /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
            // US: 01/15/2024 or 1/15/2024
            /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
            // US short: 01/15/24
            /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/,
            // Military: 15JAN2024
            /^(\d{1,2})([A-Z]{3})(\d{4})$/i,
            // Military with space: 15 JAN 2024
            /^(\d{1,2})\s+([A-Z]{3})\s+(\d{4})$/i
        ];

        const months = {
            'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5,
            'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
        };

        // Try ISO format
        let match = str.match(formats[0]);
        if (match) {
            const date = new Date(match[1], match[2] - 1, match[3]);
            return date.toISOString().split('T')[0];
        }

        // Try US format MM/DD/YYYY
        match = str.match(formats[1]);
        if (match) {
            const date = new Date(match[3], match[1] - 1, match[2]);
            return date.toISOString().split('T')[0];
        }

        // Try US short format MM/DD/YY
        match = str.match(formats[2]);
        if (match) {
            let year = parseInt(match[3]);
            year = year > 50 ? 1900 + year : 2000 + year;
            const date = new Date(year, match[1] - 1, match[2]);
            return date.toISOString().split('T')[0];
        }

        // Try military formats
        match = str.match(formats[3]) || str.match(formats[4]);
        if (match) {
            const month = months[match[2].toUpperCase()];
            if (month !== undefined) {
                const date = new Date(match[3], month, match[1]);
                return date.toISOString().split('T')[0];
            }
        }

        // Try native Date parsing as fallback
        const parsed = new Date(str);
        if (!isNaN(parsed)) {
            return parsed.toISOString().split('T')[0];
        }

        console.warn(`Could not parse date: ${value}`);
        return null;
    },

    /**
     * Parse full name into components
     */
    parseName(fullName) {
        if (!fullName) return { lastName: '', firstName: '', middleInitial: '' };

        const str = String(fullName).trim();

        // Handle "LAST, FIRST MI" format
        if (str.includes(',')) {
            const parts = str.split(',').map(p => p.trim());
            const lastName = parts[0];
            const firstParts = (parts[1] || '').split(/\s+/);
            const firstName = firstParts[0] || '';
            const middleInitial = firstParts[1] ? firstParts[1].charAt(0) : '';

            return { lastName, firstName, middleInitial };
        }

        // Handle "FIRST LAST" format
        const parts = str.split(/\s+/);
        if (parts.length === 1) {
            return { lastName: parts[0], firstName: '', middleInitial: '' };
        } else if (parts.length === 2) {
            return { lastName: parts[1], firstName: parts[0], middleInitial: '' };
        } else {
            return {
                firstName: parts[0],
                middleInitial: parts[1].length === 1 ? parts[1] : '',
                lastName: parts.slice(-1)[0]
            };
        }
    },

    /**
     * Transform row data using column mapping
     */
    transformRow(row, mapping) {
        const result = {};

        for (const [sourceCol, targetField] of Object.entries(mapping)) {
            if (!targetField || targetField === 'ignore') continue;

            let value = row[sourceCol];

            // Apply field-specific transformations
            const fieldDef = this.COLUMN_MAPPINGS[targetField];
            if (fieldDef && fieldDef.transform && value) {
                value = fieldDef.transform(value);
            }

            // Handle special case: fullName needs to be parsed
            if (targetField === 'fullName' && value) {
                const parsed = this.parseName(value);
                result.lastName = result.lastName || parsed.lastName;
                result.firstName = result.firstName || parsed.firstName;
                result.middleInitial = result.middleInitial || parsed.middleInitial;
            } else {
                result[targetField] = value;
            }
        }

        // Normalize rank if present
        if (result.rank) {
            result.rank = TEEPQualifications.normalizeRank(result.rank);
        }

        // Clean up EDIPI (remove non-numeric)
        if (result.edipi) {
            result.edipi = String(result.edipi).replace(/\D/g, '');
        }

        return result;
    },

    /**
     * Import Marines from parsed data
     */
    async importMarines(data, mapping, options = {}) {
        const results = {
            total: data.length,
            added: 0,
            updated: 0,
            skipped: 0,
            errors: []
        };

        for (let i = 0; i < data.length; i++) {
            const row = data[i];

            try {
                const marine = this.transformRow(row, mapping);

                // Validate minimum required fields
                if (!marine.edipi && (!marine.lastName || !marine.firstName)) {
                    results.errors.push({
                        row: i + 1,
                        message: 'Missing required identification (EDIPI or Name)',
                        data: row
                    });
                    results.skipped++;
                    continue;
                }

                // Set default status
                marine.status = marine.status || 'present';

                // Check for existing Marine
                let existing = null;
                if (marine.edipi) {
                    existing = await TEEPStorage.getMarineByEdipi(marine.edipi);
                }

                if (existing) {
                    if (options.updateExisting) {
                        marine.id = existing.id;
                        marine.createdAt = existing.createdAt;
                        await TEEPStorage.updateMarine(marine);
                        results.updated++;
                    } else {
                        results.skipped++;
                    }
                } else {
                    await TEEPStorage.addMarine(marine);
                    results.added++;
                }
            } catch (error) {
                results.errors.push({
                    row: i + 1,
                    message: error.message,
                    data: row
                });
            }
        }

        // Log the import
        await TEEPStorage.logImport({
            type: 'marines',
            source: options.source || 'file_import',
            fileName: options.fileName,
            results: {
                total: results.total,
                added: results.added,
                updated: results.updated,
                skipped: results.skipped,
                errorCount: results.errors.length
            }
        });

        return results;
    },

    /**
     * Import qualifications from parsed data
     */
    async importQualifications(data, mapping, qualType, options = {}) {
        const results = {
            total: data.length,
            added: 0,
            updated: 0,
            skipped: 0,
            errors: []
        };

        for (let i = 0; i < data.length; i++) {
            const row = data[i];

            try {
                // Get EDIPI from mapping
                const edipiCol = Object.keys(mapping).find(k => mapping[k] === 'edipi');
                const edipi = edipiCol ? String(row[edipiCol]).replace(/\D/g, '') : null;

                if (!edipi) {
                    results.errors.push({
                        row: i + 1,
                        message: 'No EDIPI to identify Marine',
                        data: row
                    });
                    results.skipped++;
                    continue;
                }

                // Find Marine
                const marine = await TEEPStorage.getMarineByEdipi(edipi);
                if (!marine) {
                    results.errors.push({
                        row: i + 1,
                        message: `Marine with EDIPI ${edipi} not found`,
                        data: row
                    });
                    results.skipped++;
                    continue;
                }

                // Get completion date
                const dateCol = Object.keys(mapping).find(k =>
                    mapping[k] === 'completionDate' || mapping[k] === 'date'
                );
                const completionDate = dateCol ? this.parseDate(row[dateCol]) : new Date().toISOString().split('T')[0];

                // Get score if tracked
                const scoreCol = Object.keys(mapping).find(k => mapping[k] === 'score');
                const score = scoreCol ? parseInt(row[scoreCol]) || null : null;

                // Create qualification record
                const qualTypeObj = TEEPQualifications.getQualificationType(qualType);
                const qualification = {
                    marineId: marine.id,
                    type: qualType,
                    completionDate: completionDate,
                    expirationDate: qualTypeObj ?
                        TEEPQualifications.calculateExpiration(qualTypeObj, completionDate, marine.eas) :
                        null,
                    score: score,
                    source: options.source || 'import'
                };

                await TEEPStorage.addQualification(qualification);
                results.added++;

            } catch (error) {
                results.errors.push({
                    row: i + 1,
                    message: error.message,
                    data: row
                });
            }
        }

        // Log the import
        await TEEPStorage.logImport({
            type: 'qualifications',
            qualificationType: qualType,
            source: options.source || 'file_import',
            fileName: options.fileName,
            results: {
                total: results.total,
                added: results.added,
                skipped: results.skipped,
                errorCount: results.errors.length
            }
        });

        return results;
    },

    /**
     * Preview import data (first 5 rows)
     */
    previewData(data, mapping, limit = 5) {
        const preview = [];

        for (let i = 0; i < Math.min(data.length, limit); i++) {
            preview.push(this.transformRow(data[i], mapping));
        }

        return preview;
    },

    /**
     * Get available fields for mapping dropdown
     */
    getAvailableFields() {
        const fields = [
            { value: 'ignore', label: '-- Ignore Column --' }
        ];

        for (const [fieldId, fieldDef] of Object.entries(this.COLUMN_MAPPINGS)) {
            fields.push({
                value: fieldId,
                label: fieldDef.label,
                required: fieldDef.required
            });
        }

        return fields;
    },

    /**
     * Get import statistics
     */
    async getImportStats() {
        const history = await TEEPStorage.getImportHistory();

        return {
            totalImports: history.length,
            lastImport: history[0] || null,
            marineSources: history
                .filter(h => h.type === 'marines')
                .reduce((acc, h) => {
                    acc[h.source] = (acc[h.source] || 0) + 1;
                    return acc;
                }, {})
        };
    }
};
