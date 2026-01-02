/**
 * TEEP Tracker - IndexedDB Storage Module
 * Handles all data persistence using IndexedDB for large roster data
 */

const TEEPStorage = {
    DB_NAME: 'teep-tracker',
    DB_VERSION: 1,
    db: null,

    /**
     * Initialize the IndexedDB database
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

            request.onerror = () => {
                console.error('Failed to open database:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('Database opened successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Marines store - primary roster data
                if (!db.objectStoreNames.contains('marines')) {
                    const marinesStore = db.createObjectStore('marines', { keyPath: 'id', autoIncrement: true });
                    marinesStore.createIndex('edipi', 'edipi', { unique: true });
                    marinesStore.createIndex('lastName', 'lastName', { unique: false });
                    marinesStore.createIndex('rank', 'rank', { unique: false });
                    marinesStore.createIndex('mos', 'mos', { unique: false });
                    marinesStore.createIndex('status', 'status', { unique: false });
                    marinesStore.createIndex('section', 'section', { unique: false });
                }

                // Qualifications store - all qualifications for all Marines
                if (!db.objectStoreNames.contains('qualifications')) {
                    const qualsStore = db.createObjectStore('qualifications', { keyPath: 'id', autoIncrement: true });
                    qualsStore.createIndex('marineId', 'marineId', { unique: false });
                    qualsStore.createIndex('type', 'type', { unique: false });
                    qualsStore.createIndex('expirationDate', 'expirationDate', { unique: false });
                    qualsStore.createIndex('marineId_type', ['marineId', 'type'], { unique: false });
                }

                // Qualification types store - custom qualification definitions
                if (!db.objectStoreNames.contains('qualificationTypes')) {
                    const typesStore = db.createObjectStore('qualificationTypes', { keyPath: 'id' });
                    typesStore.createIndex('category', 'category', { unique: false });
                    typesStore.createIndex('name', 'name', { unique: false });
                }

                // Import history store - track imports for rollback
                if (!db.objectStoreNames.contains('importHistory')) {
                    const importStore = db.createObjectStore('importHistory', { keyPath: 'id', autoIncrement: true });
                    importStore.createIndex('timestamp', 'timestamp', { unique: false });
                    importStore.createIndex('type', 'type', { unique: false });
                }

                // Settings store - user preferences
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }

                console.log('Database schema created/upgraded');
            };
        });
    },

    /**
     * Generic transaction helper
     */
    async transaction(storeName, mode = 'readonly') {
        if (!this.db) await this.init();
        return this.db.transaction(storeName, mode).objectStore(storeName);
    },

    // ==================== MARINES CRUD ====================

    /**
     * Add a new Marine to the roster
     */
    async addMarine(marine) {
        const store = await this.transaction('marines', 'readwrite');
        return new Promise((resolve, reject) => {
            // Ensure required fields
            marine.createdAt = marine.createdAt || new Date().toISOString();
            marine.updatedAt = new Date().toISOString();
            marine.status = marine.status || 'present';

            const request = store.add(marine);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Update an existing Marine
     */
    async updateMarine(marine) {
        const store = await this.transaction('marines', 'readwrite');
        return new Promise((resolve, reject) => {
            marine.updatedAt = new Date().toISOString();
            const request = store.put(marine);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Delete a Marine and their qualifications
     */
    async deleteMarine(id) {
        // Delete qualifications first
        const quals = await this.getQualificationsByMarine(id);
        for (const qual of quals) {
            await this.deleteQualification(qual.id);
        }

        // Delete the Marine
        const store = await this.transaction('marines', 'readwrite');
        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Get a Marine by ID
     */
    async getMarine(id) {
        const store = await this.transaction('marines');
        return new Promise((resolve, reject) => {
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Get a Marine by EDIPI
     */
    async getMarineByEdipi(edipi) {
        const store = await this.transaction('marines');
        return new Promise((resolve, reject) => {
            const index = store.index('edipi');
            const request = index.get(edipi);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Get all Marines
     */
    async getAllMarines() {
        const store = await this.transaction('marines');
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Search Marines with filters
     */
    async searchMarines(filters = {}) {
        const allMarines = await this.getAllMarines();

        return allMarines.filter(marine => {
            // Status filter
            if (filters.status && filters.status !== 'all') {
                if (marine.status !== filters.status) return false;
            }

            // Section filter
            if (filters.section && filters.section !== 'all') {
                if (marine.section !== filters.section) return false;
            }

            // Rank filter
            if (filters.rank && filters.rank !== 'all') {
                if (marine.rank !== filters.rank) return false;
            }

            // MOS filter
            if (filters.mos && filters.mos !== 'all') {
                if (marine.mos !== filters.mos) return false;
            }

            // Text search
            if (filters.search) {
                const searchLower = filters.search.toLowerCase();
                const searchFields = [
                    marine.lastName,
                    marine.firstName,
                    marine.edipi,
                    marine.rank,
                    marine.mos
                ].filter(Boolean).map(f => f.toLowerCase());

                if (!searchFields.some(f => f.includes(searchLower))) {
                    return false;
                }
            }

            return true;
        });
    },

    /**
     * Get count of Marines by status
     */
    async getMarineCountByStatus() {
        const marines = await this.getAllMarines();
        const counts = {
            total: marines.length,
            present: 0,
            leave: 0,
            tad: 0,
            deployment: 0,
            med_hold: 0,
            light_duty: 0,
            legal_hold: 0,
            other: 0
        };

        marines.forEach(marine => {
            if (counts.hasOwnProperty(marine.status)) {
                counts[marine.status]++;
            } else {
                counts.other++;
            }
        });

        return counts;
    },

    // ==================== QUALIFICATIONS CRUD ====================

    /**
     * Add a qualification to a Marine
     */
    async addQualification(qualification) {
        const store = await this.transaction('qualifications', 'readwrite');
        return new Promise((resolve, reject) => {
            qualification.createdAt = qualification.createdAt || new Date().toISOString();
            qualification.updatedAt = new Date().toISOString();

            const request = store.add(qualification);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Update a qualification
     */
    async updateQualification(qualification) {
        const store = await this.transaction('qualifications', 'readwrite');
        return new Promise((resolve, reject) => {
            qualification.updatedAt = new Date().toISOString();
            const request = store.put(qualification);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Delete a qualification
     */
    async deleteQualification(id) {
        const store = await this.transaction('qualifications', 'readwrite');
        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Get all qualifications for a Marine
     */
    async getQualificationsByMarine(marineId) {
        const store = await this.transaction('qualifications');
        return new Promise((resolve, reject) => {
            const index = store.index('marineId');
            const request = index.getAll(marineId);
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Get all qualifications of a specific type
     */
    async getQualificationsByType(type) {
        const store = await this.transaction('qualifications');
        return new Promise((resolve, reject) => {
            const index = store.index('type');
            const request = index.getAll(type);
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Get all qualifications
     */
    async getAllQualifications() {
        const store = await this.transaction('qualifications');
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Get expiring qualifications within a date range
     */
    async getExpiringQualifications(daysAhead = 30) {
        const allQuals = await this.getAllQualifications();
        const now = new Date();
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + daysAhead);

        return allQuals.filter(qual => {
            if (!qual.expirationDate) return false;
            const expDate = new Date(qual.expirationDate);
            return expDate >= now && expDate <= futureDate;
        }).sort((a, b) => new Date(a.expirationDate) - new Date(b.expirationDate));
    },

    /**
     * Get overdue (expired) qualifications
     */
    async getOverdueQualifications() {
        const allQuals = await this.getAllQualifications();
        const now = new Date();

        return allQuals.filter(qual => {
            if (!qual.expirationDate) return false;
            return new Date(qual.expirationDate) < now;
        }).sort((a, b) => new Date(a.expirationDate) - new Date(b.expirationDate));
    },

    // ==================== QUALIFICATION TYPES ====================

    /**
     * Add or update a qualification type definition
     */
    async saveQualificationType(qualType) {
        const store = await this.transaction('qualificationTypes', 'readwrite');
        return new Promise((resolve, reject) => {
            const request = store.put(qualType);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Get all qualification types
     */
    async getQualificationTypes() {
        const store = await this.transaction('qualificationTypes');
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Delete a qualification type
     */
    async deleteQualificationType(id) {
        const store = await this.transaction('qualificationTypes', 'readwrite');
        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    // ==================== IMPORT HISTORY ====================

    /**
     * Log an import operation
     */
    async logImport(importRecord) {
        const store = await this.transaction('importHistory', 'readwrite');
        return new Promise((resolve, reject) => {
            importRecord.timestamp = new Date().toISOString();
            const request = store.add(importRecord);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Get import history
     */
    async getImportHistory() {
        const store = await this.transaction('importHistory');
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => {
                const results = request.result || [];
                results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                resolve(results);
            };
            request.onerror = () => reject(request.error);
        });
    },

    // ==================== SETTINGS ====================

    /**
     * Save a setting
     */
    async setSetting(key, value) {
        const store = await this.transaction('settings', 'readwrite');
        return new Promise((resolve, reject) => {
            const request = store.put({ key, value });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Get a setting
     */
    async getSetting(key, defaultValue = null) {
        const store = await this.transaction('settings');
        return new Promise((resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = () => {
                resolve(request.result ? request.result.value : defaultValue);
            };
            request.onerror = () => reject(request.error);
        });
    },

    // ==================== BULK OPERATIONS ====================

    /**
     * Bulk import Marines (for CSV/Excel imports)
     */
    async bulkImportMarines(marines, options = {}) {
        const results = {
            added: 0,
            updated: 0,
            skipped: 0,
            errors: []
        };

        for (const marine of marines) {
            try {
                // Check if Marine exists by EDIPI
                if (marine.edipi) {
                    const existing = await this.getMarineByEdipi(marine.edipi);
                    if (existing) {
                        if (options.updateExisting) {
                            marine.id = existing.id;
                            await this.updateMarine(marine);
                            results.updated++;
                        } else {
                            results.skipped++;
                        }
                        continue;
                    }
                }

                await this.addMarine(marine);
                results.added++;
            } catch (error) {
                results.errors.push({
                    marine: marine,
                    error: error.message
                });
            }
        }

        // Log the import
        await this.logImport({
            type: 'marines',
            source: options.source || 'unknown',
            results: results
        });

        return results;
    },

    /**
     * Bulk import qualifications
     */
    async bulkImportQualifications(qualifications, options = {}) {
        const results = {
            added: 0,
            updated: 0,
            skipped: 0,
            errors: []
        };

        for (const qual of qualifications) {
            try {
                // Find Marine by EDIPI if marineId not provided
                if (!qual.marineId && qual.edipi) {
                    const marine = await this.getMarineByEdipi(qual.edipi);
                    if (marine) {
                        qual.marineId = marine.id;
                    } else {
                        results.errors.push({
                            qualification: qual,
                            error: `Marine with EDIPI ${qual.edipi} not found`
                        });
                        continue;
                    }
                }

                await this.addQualification(qual);
                results.added++;
            } catch (error) {
                results.errors.push({
                    qualification: qual,
                    error: error.message
                });
            }
        }

        // Log the import
        await this.logImport({
            type: 'qualifications',
            source: options.source || 'unknown',
            results: results
        });

        return results;
    },

    // ==================== EXPORT ====================

    /**
     * Export all data as JSON for backup
     */
    async exportAllData() {
        const marines = await this.getAllMarines();
        const qualifications = await this.getAllQualifications();
        const qualificationTypes = await this.getQualificationTypes();
        const settings = await this.getAllSettings();

        return {
            version: this.DB_VERSION,
            exportDate: new Date().toISOString(),
            data: {
                marines,
                qualifications,
                qualificationTypes,
                settings
            }
        };
    },

    /**
     * Get all settings
     */
    async getAllSettings() {
        const store = await this.transaction('settings');
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => {
                const settings = {};
                (request.result || []).forEach(s => {
                    settings[s.key] = s.value;
                });
                resolve(settings);
            };
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Import data from JSON backup
     */
    async importFromBackup(backup) {
        if (!backup.data) {
            throw new Error('Invalid backup format');
        }

        const results = {
            marines: { added: 0, errors: [] },
            qualifications: { added: 0, errors: [] },
            qualificationTypes: { added: 0, errors: [] }
        };

        // Import qualification types first
        if (backup.data.qualificationTypes) {
            for (const qualType of backup.data.qualificationTypes) {
                try {
                    await this.saveQualificationType(qualType);
                    results.qualificationTypes.added++;
                } catch (error) {
                    results.qualificationTypes.errors.push(error.message);
                }
            }
        }

        // Import Marines
        if (backup.data.marines) {
            // Create ID mapping for qualifications
            const idMap = new Map();

            for (const marine of backup.data.marines) {
                const oldId = marine.id;
                delete marine.id; // Let IndexedDB assign new ID

                try {
                    const newId = await this.addMarine(marine);
                    idMap.set(oldId, newId);
                    results.marines.added++;
                } catch (error) {
                    results.marines.errors.push(error.message);
                }
            }

            // Import qualifications with updated Marine IDs
            if (backup.data.qualifications) {
                for (const qual of backup.data.qualifications) {
                    const newMarineId = idMap.get(qual.marineId);
                    if (newMarineId) {
                        qual.marineId = newMarineId;
                        delete qual.id;

                        try {
                            await this.addQualification(qual);
                            results.qualifications.added++;
                        } catch (error) {
                            results.qualifications.errors.push(error.message);
                        }
                    }
                }
            }
        }

        // Import settings
        if (backup.data.settings) {
            for (const [key, value] of Object.entries(backup.data.settings)) {
                await this.setSetting(key, value);
            }
        }

        return results;
    },

    /**
     * Clear all data (with confirmation)
     */
    async clearAllData() {
        const stores = ['marines', 'qualifications', 'qualificationTypes', 'importHistory'];

        for (const storeName of stores) {
            const store = await this.transaction(storeName, 'readwrite');
            await new Promise((resolve, reject) => {
                const request = store.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }

        console.log('All data cleared');
    },

    /**
     * Get unique values for a field (for filter dropdowns)
     */
    async getUniqueValues(field) {
        const marines = await this.getAllMarines();
        const values = new Set();

        marines.forEach(marine => {
            if (marine[field]) {
                values.add(marine[field]);
            }
        });

        return Array.from(values).sort();
    }
};

// Auto-initialize when script loads
TEEPStorage.init().catch(console.error);
