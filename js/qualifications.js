/**
 * TEEP Tracker - Qualifications Module
 * Handles qualification types, expiration calculations, and status logic
 */

const TEEPQualifications = {
    /**
     * Qualification cycle types
     * - calendar_window: Must complete within date range (e.g., PFT Jan-Jun)
     * - fiscal_year: Must complete during fiscal year (Oct-Sep)
     * - rolling: Expires X months/years from completion
     * - one_time: Never expires once earned
     */
    CYCLE_TYPES: {
        CALENDAR_WINDOW: 'calendar_window',
        FISCAL_YEAR: 'fiscal_year',
        ROLLING: 'rolling',
        ONE_TIME: 'one_time'
    },

    /**
     * Default qualification types organized by category
     */
    DEFAULT_QUAL_TYPES: {
        fitness: [
            {
                id: 'pft',
                name: 'PFT',
                fullName: 'Physical Fitness Test',
                category: 'fitness',
                cycleType: 'calendar_window',
                windowStart: { month: 1, day: 1 },  // January 1
                windowEnd: { month: 6, day: 30 },   // June 30
                required: true,
                trackScore: true
            },
            {
                id: 'cft',
                name: 'CFT',
                fullName: 'Combat Fitness Test',
                category: 'fitness',
                cycleType: 'calendar_window',
                windowStart: { month: 7, day: 1 },  // July 1
                windowEnd: { month: 12, day: 31 }, // December 31
                required: true,
                trackScore: true
            },
            {
                id: 'bca',
                name: 'BCA',
                fullName: 'Body Composition Assessment',
                category: 'fitness',
                cycleType: 'calendar_window',
                windowStart: { month: 1, day: 1 },
                windowEnd: { month: 12, day: 31 },
                required: true,
                trackScore: false
            }
        ],
        weapons: [
            {
                id: 'rifle_qual',
                name: 'Rifle Qual',
                fullName: 'Annual Rifle Qualification',
                category: 'weapons',
                cycleType: 'fiscal_year',
                required: true,
                trackScore: true,
                scoreRanges: {
                    expert: { min: 305, max: 350 },
                    sharpshooter: { min: 280, max: 304 },
                    marksman: { min: 250, max: 279 },
                    unqualified: { min: 0, max: 249 }
                }
            },
            {
                id: 'pistol_qual',
                name: 'Pistol Qual',
                fullName: 'Pistol Qualification',
                category: 'weapons',
                cycleType: 'fiscal_year',
                required: false,
                trackScore: true
            }
        ],
        training: [
            {
                id: 'annual_training',
                name: 'Annual Training',
                fullName: 'Annual Training Requirements',
                category: 'training',
                cycleType: 'fiscal_year',
                required: true
            },
            {
                id: 'cyber_awareness',
                name: 'Cyber Awareness',
                fullName: 'Cyber Awareness Challenge',
                category: 'training',
                cycleType: 'fiscal_year',
                required: true
            },
            {
                id: 'sharp',
                name: 'SHARP/SAPR',
                fullName: 'Sexual Assault Prevention and Response',
                category: 'training',
                cycleType: 'fiscal_year',
                required: true
            },
            {
                id: 'suicide_prevention',
                name: 'Suicide Prevention',
                fullName: 'Suicide Prevention Training',
                category: 'training',
                cycleType: 'fiscal_year',
                required: true
            }
        ],
        licenses: [
            {
                id: 'license_hmmwv',
                name: 'HMMWV License',
                fullName: 'HMMWV Operator License',
                category: 'licenses',
                cycleType: 'rolling',
                expirationMonths: 48, // 4 years
                easAware: true // Expires at EAS if earlier
            },
            {
                id: 'license_7ton',
                name: '7-Ton License',
                fullName: 'MTVR/7-Ton Operator License',
                category: 'licenses',
                cycleType: 'rolling',
                expirationMonths: 48,
                easAware: true
            },
            {
                id: 'license_forklift',
                name: 'Forklift License',
                fullName: 'Forklift Operator License',
                category: 'licenses',
                cycleType: 'rolling',
                expirationMonths: 48,
                easAware: true
            },
            {
                id: 'license_lav',
                name: 'LAV License',
                fullName: 'LAV Operator License',
                category: 'licenses',
                cycleType: 'rolling',
                expirationMonths: 48,
                easAware: true
            }
        ],
        combat: [
            {
                id: 'mcmap_tan',
                name: 'MCMAP Tan',
                fullName: 'MCMAP Tan Belt',
                category: 'combat',
                cycleType: 'one_time',
                level: 1
            },
            {
                id: 'mcmap_gray',
                name: 'MCMAP Gray',
                fullName: 'MCMAP Gray Belt',
                category: 'combat',
                cycleType: 'one_time',
                level: 2
            },
            {
                id: 'mcmap_green',
                name: 'MCMAP Green',
                fullName: 'MCMAP Green Belt',
                category: 'combat',
                cycleType: 'one_time',
                level: 3
            },
            {
                id: 'mcmap_brown',
                name: 'MCMAP Brown',
                fullName: 'MCMAP Brown Belt',
                category: 'combat',
                cycleType: 'one_time',
                level: 4
            },
            {
                id: 'mcmap_black',
                name: 'MCMAP Black',
                fullName: 'MCMAP Black Belt (1st Degree)',
                category: 'combat',
                cycleType: 'one_time',
                level: 5
            },
            {
                id: 'swim_qual',
                name: 'Swim Qual',
                fullName: 'Basic Swim Qualification',
                category: 'combat',
                cycleType: 'rolling',
                expirationMonths: 24 // 2 years
            }
        ],
        medical: [
            {
                id: 'pha',
                name: 'PHA',
                fullName: 'Periodic Health Assessment',
                category: 'medical',
                cycleType: 'rolling',
                expirationMonths: 12,
                required: true
            },
            {
                id: 'dental',
                name: 'Dental Readiness',
                fullName: 'Annual Dental Exam',
                category: 'medical',
                cycleType: 'rolling',
                expirationMonths: 12,
                required: true
            },
            {
                id: 'hiv',
                name: 'HIV Test',
                fullName: 'HIV Screening',
                category: 'medical',
                cycleType: 'rolling',
                expirationMonths: 24
            },
            {
                id: 'hearing',
                name: 'Hearing Test',
                fullName: 'Annual Hearing Conservation',
                category: 'medical',
                cycleType: 'fiscal_year'
            }
        ],
        pme: [
            {
                id: 'corporal_course',
                name: "Corporal's Course",
                fullName: "Corporal's Course",
                category: 'pme',
                cycleType: 'one_time',
                requiredRank: 'Cpl'
            },
            {
                id: 'sergeants_course',
                name: "Sergeant's Course",
                fullName: "Sergeant's Course",
                category: 'pme',
                cycleType: 'one_time',
                requiredRank: 'Sgt'
            },
            {
                id: 'career_course',
                name: 'Career Course',
                fullName: 'Career Course',
                category: 'pme',
                cycleType: 'one_time',
                requiredRank: 'SSgt'
            },
            {
                id: 'advanced_course',
                name: 'Advanced Course',
                fullName: 'Advanced Course',
                category: 'pme',
                cycleType: 'one_time',
                requiredRank: 'GySgt'
            }
        ]
    },

    /**
     * Rank normalization mappings
     */
    RANK_MAPPINGS: {
        // Enlisted
        'PVT': 'Pvt', 'PRIVATE': 'Pvt', 'E-1': 'Pvt', 'E1': 'Pvt',
        'PFC': 'PFC', 'PRIVATE FIRST CLASS': 'PFC', 'E-2': 'PFC', 'E2': 'PFC',
        'LCPL': 'LCpl', 'LANCE CORPORAL': 'LCpl', 'E-3': 'LCpl', 'E3': 'LCpl',
        'CPL': 'Cpl', 'CORPORAL': 'Cpl', 'E-4': 'Cpl', 'E4': 'Cpl',
        'SGT': 'Sgt', 'SERGEANT': 'Sgt', 'E-5': 'Sgt', 'E5': 'Sgt',
        'SSGT': 'SSgt', 'STAFF SERGEANT': 'SSgt', 'E-6': 'SSgt', 'E6': 'SSgt',
        'GYSGT': 'GySgt', 'GUNNERY SERGEANT': 'GySgt', 'E-7': 'GySgt', 'E7': 'GySgt',
        'MSGT': 'MSgt', 'MASTER SERGEANT': 'MSgt', 'E-8': 'MSgt', 'E8': 'MSgt',
        'FIRST SGT': 'FirstSgt', 'FIRST SERGEANT': 'FirstSgt', '1STSGT': 'FirstSgt',
        'MGYSGT': 'MGySgt', 'MASTER GUNNERY SERGEANT': 'MGySgt', 'E-9': 'MGySgt', 'E9': 'MGySgt',
        'SGTMAJ': 'SgtMaj', 'SERGEANT MAJOR': 'SgtMaj',

        // Warrant Officers
        'WO1': 'WO', 'WO-1': 'WO', 'WARRANT OFFICER': 'WO',
        'CWO2': 'CWO2', 'CWO-2': 'CWO2', 'CHIEF WARRANT OFFICER 2': 'CWO2',
        'CWO3': 'CWO3', 'CWO-3': 'CWO3', 'CHIEF WARRANT OFFICER 3': 'CWO3',
        'CWO4': 'CWO4', 'CWO-4': 'CWO4', 'CHIEF WARRANT OFFICER 4': 'CWO4',
        'CWO5': 'CWO5', 'CWO-5': 'CWO5', 'CHIEF WARRANT OFFICER 5': 'CWO5',

        // Officers
        '2NDLT': '2ndLt', '2ND LT': '2ndLt', 'SECOND LIEUTENANT': '2ndLt', 'O-1': '2ndLt', 'O1': '2ndLt',
        '1STLT': '1stLt', '1ST LT': '1stLt', 'FIRST LIEUTENANT': '1stLt', 'O-2': '1stLt', 'O2': '1stLt',
        'CAPT': 'Capt', 'CAPTAIN': 'Capt', 'O-3': 'Capt', 'O3': 'Capt',
        'MAJ': 'Maj', 'MAJOR': 'Maj', 'O-4': 'Maj', 'O4': 'Maj',
        'LTCOL': 'LtCol', 'LT COL': 'LtCol', 'LIEUTENANT COLONEL': 'LtCol', 'O-5': 'LtCol', 'O5': 'LtCol',
        'COL': 'Col', 'COLONEL': 'Col', 'O-6': 'Col', 'O6': 'Col'
    },

    /**
     * Rank order for sorting
     */
    RANK_ORDER: [
        'Pvt', 'PFC', 'LCpl', 'Cpl', 'Sgt', 'SSgt', 'GySgt', 'MSgt', 'FirstSgt', 'MGySgt', 'SgtMaj',
        'WO', 'CWO2', 'CWO3', 'CWO4', 'CWO5',
        '2ndLt', '1stLt', 'Capt', 'Maj', 'LtCol', 'Col'
    ],

    /**
     * Normalize a rank to standard format
     */
    normalizeRank(rank) {
        if (!rank) return '';
        const upperRank = rank.toUpperCase().trim();

        // Check direct mapping
        if (this.RANK_MAPPINGS[upperRank]) {
            return this.RANK_MAPPINGS[upperRank];
        }

        // Check if already normalized
        if (this.RANK_ORDER.includes(rank)) {
            return rank;
        }

        // Return original if no match
        return rank;
    },

    /**
     * Compare ranks for sorting
     */
    compareRanks(rankA, rankB) {
        const normalizedA = this.normalizeRank(rankA);
        const normalizedB = this.normalizeRank(rankB);

        const indexA = this.RANK_ORDER.indexOf(normalizedA);
        const indexB = this.RANK_ORDER.indexOf(normalizedB);

        // Unknown ranks go to end
        const orderA = indexA === -1 ? 999 : indexA;
        const orderB = indexB === -1 ? 999 : indexB;

        return orderA - orderB;
    },

    /**
     * Calculate expiration date for a qualification
     */
    calculateExpiration(qualType, completionDate, marineEas = null) {
        const completion = new Date(completionDate);

        switch (qualType.cycleType) {
            case 'one_time':
                return null; // Never expires

            case 'calendar_window':
                // Expires at end of next window
                const endMonth = qualType.windowEnd.month - 1; // JS months are 0-indexed
                const endDay = qualType.windowEnd.day;
                let expYear = completion.getFullYear();

                // If completed during the window, expires at end of next year's window
                // If completed outside window, expires at end of current year's window
                const windowEnd = new Date(expYear, endMonth, endDay);
                if (completion <= windowEnd) {
                    expYear += 1;
                } else {
                    expYear += 2;
                }

                return new Date(expYear, endMonth, endDay);

            case 'fiscal_year':
                // Expires at end of fiscal year (Sep 30)
                let fy = this.getFiscalYear(completion);
                // If completed in current FY, expires at end of next FY
                return new Date(fy + 1, 8, 30); // Sep 30 of next FY

            case 'rolling':
                // Expires X months from completion
                const expirationMonths = qualType.expirationMonths || 12;
                const expiration = new Date(completion);
                expiration.setMonth(expiration.getMonth() + expirationMonths);

                // Check EAS-aware licenses
                if (qualType.easAware && marineEas) {
                    const eas = new Date(marineEas);
                    if (eas < expiration) {
                        return eas;
                    }
                }

                return expiration;

            default:
                return null;
        }
    },

    /**
     * Get fiscal year for a date
     * FY starts Oct 1 of previous calendar year
     */
    getFiscalYear(date) {
        const d = new Date(date);
        const month = d.getMonth(); // 0-11
        const year = d.getFullYear();

        // Oct (9), Nov (10), Dec (11) are in next fiscal year
        if (month >= 9) {
            return year + 1;
        }
        return year;
    },

    /**
     * Get current fiscal year
     */
    getCurrentFiscalYear() {
        return this.getFiscalYear(new Date());
    },

    /**
     * Check if a qualification is current
     */
    isQualificationCurrent(qualification) {
        if (!qualification.expirationDate) {
            // One-time qualifications with no expiration are always current
            return qualification.completionDate ? true : false;
        }

        const now = new Date();
        const expiration = new Date(qualification.expirationDate);

        return expiration >= now;
    },

    /**
     * Get qualification status
     */
    getQualificationStatus(qualification) {
        if (!qualification.completionDate) {
            return { status: 'missing', label: 'Not Completed', class: 'status-expired' };
        }

        if (!qualification.expirationDate) {
            return { status: 'current', label: 'Current', class: 'status-current' };
        }

        const now = new Date();
        const expiration = new Date(qualification.expirationDate);
        const thirtyDaysOut = new Date();
        thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);
        const ninetyDaysOut = new Date();
        ninetyDaysOut.setDate(ninetyDaysOut.getDate() + 90);

        if (expiration < now) {
            return { status: 'expired', label: 'Expired', class: 'status-expired' };
        }

        if (expiration <= thirtyDaysOut) {
            return { status: 'expiring_soon', label: 'Expires < 30 Days', class: 'status-warning' };
        }

        if (expiration <= ninetyDaysOut) {
            return { status: 'expiring', label: 'Expires < 90 Days', class: 'status-caution' };
        }

        return { status: 'current', label: 'Current', class: 'status-current' };
    },

    /**
     * Get all qualification types as a flat array
     */
    getAllQualificationTypes() {
        const types = [];
        for (const category of Object.keys(this.DEFAULT_QUAL_TYPES)) {
            types.push(...this.DEFAULT_QUAL_TYPES[category]);
        }
        return types;
    },

    /**
     * Get qualification type by ID
     */
    getQualificationType(id) {
        for (const category of Object.keys(this.DEFAULT_QUAL_TYPES)) {
            const found = this.DEFAULT_QUAL_TYPES[category].find(q => q.id === id);
            if (found) return found;
        }
        return null;
    },

    /**
     * Get qualification categories
     */
    getCategories() {
        return Object.keys(this.DEFAULT_QUAL_TYPES).map(key => ({
            id: key,
            name: this.formatCategoryName(key),
            count: this.DEFAULT_QUAL_TYPES[key].length
        }));
    },

    /**
     * Format category name for display
     */
    formatCategoryName(category) {
        const names = {
            fitness: 'Physical Fitness',
            weapons: 'Weapons Qualification',
            training: 'Annual Training',
            licenses: 'Licenses/Certifications',
            combat: 'Combat Training',
            medical: 'Medical Readiness',
            pme: 'Professional Military Education'
        };
        return names[category] || category.charAt(0).toUpperCase() + category.slice(1);
    },

    /**
     * Format date for display
     */
    formatDate(date) {
        if (!date) return 'N/A';
        const d = new Date(date);
        return d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    },

    /**
     * Calculate days until expiration
     */
    daysUntilExpiration(expirationDate) {
        if (!expirationDate) return null;

        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const exp = new Date(expirationDate);
        exp.setHours(0, 0, 0, 0);

        const diffTime = exp - now;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    },

    /**
     * Initialize default qualification types in storage
     */
    async initializeDefaultTypes() {
        const types = this.getAllQualificationTypes();

        for (const qualType of types) {
            await TEEPStorage.saveQualificationType(qualType);
        }

        console.log(`Initialized ${types.length} default qualification types`);
    },

    /**
     * Get Marines with a specific qualification
     */
    async getMarinesWithQualification(qualTypeId, options = {}) {
        const allMarines = await TEEPStorage.getAllMarines();
        const allQuals = await TEEPStorage.getAllQualifications();

        const results = [];

        for (const marine of allMarines) {
            // Filter by status if specified
            if (options.status && options.status !== 'all') {
                if (marine.status !== options.status) continue;
            }

            // Find qualifications for this Marine
            const marineQuals = allQuals.filter(q =>
                q.marineId === marine.id && q.type === qualTypeId
            );

            if (marineQuals.length === 0) {
                if (options.includeMissing) {
                    results.push({
                        marine,
                        qualification: null,
                        status: this.getQualificationStatus({})
                    });
                }
                continue;
            }

            // Get most recent qualification
            const latestQual = marineQuals.sort((a, b) =>
                new Date(b.completionDate) - new Date(a.completionDate)
            )[0];

            const status = this.getQualificationStatus(latestQual);

            // Filter by current only if specified
            if (options.currentOnly && status.status !== 'current') {
                continue;
            }

            results.push({
                marine,
                qualification: latestQual,
                status
            });
        }

        return results;
    },

    /**
     * Query for Marines matching qualification criteria
     */
    async queryMarines(query) {
        const allMarines = await TEEPStorage.getAllMarines();
        const allQuals = await TEEPStorage.getAllQualifications();

        let results = [...allMarines];

        // Apply status filter
        if (query.status && query.status !== 'all') {
            results = results.filter(m => m.status === query.status);
        }

        // Apply section filter
        if (query.section && query.section !== 'all') {
            results = results.filter(m => m.section === query.section);
        }

        // Apply rank filter
        if (query.rank && query.rank !== 'all') {
            results = results.filter(m => this.normalizeRank(m.rank) === query.rank);
        }

        // Apply MOS filter
        if (query.mos && query.mos !== 'all') {
            results = results.filter(m => m.mos === query.mos);
        }

        // Apply qualification requirements
        if (query.qualifications && query.qualifications.length > 0) {
            results = results.filter(marine => {
                const marineQuals = allQuals.filter(q => q.marineId === marine.id);

                return query.qualifications.every(reqQual => {
                    const matchingQuals = marineQuals.filter(q => q.type === reqQual.type);

                    if (matchingQuals.length === 0) {
                        return reqQual.required === false;
                    }

                    const latestQual = matchingQuals.sort((a, b) =>
                        new Date(b.completionDate) - new Date(a.completionDate)
                    )[0];

                    const status = this.getQualificationStatus(latestQual);

                    // Check if current qualification is required
                    if (reqQual.mustBeCurrent && status.status !== 'current') {
                        return false;
                    }

                    return true;
                });
            });
        }

        return results;
    }
};
