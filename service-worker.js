/**
 * TEEP Tracker - Service Worker
 * Provides offline support and caching
 */

const CACHE_NAME = 'teep-tracker-v1';

const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './css/styles.css',
    './js/storage.js',
    './js/qualifications.js',
    './js/import.js',
    './js/roster.js',
    './js/reports.js',
    './js/app.js',
    './manifest.json'
];

// External CDN resources to cache
const CDN_ASSETS = [
    'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching app assets');
                // Cache local assets
                return cache.addAll(ASSETS_TO_CACHE)
                    .then(() => {
                        // Try to cache CDN assets, but don't fail if they're unavailable
                        return Promise.all(
                            CDN_ASSETS.map(url =>
                                cache.add(url).catch(err => {
                                    console.warn(`[Service Worker] Failed to cache ${url}:`, err);
                                })
                            )
                        );
                    });
            })
            .then(() => {
                console.log('[Service Worker] Assets cached successfully');
                return self.skipWaiting();
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME)
                        .map((name) => {
                            console.log('[Service Worker] Removing old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[Service Worker] Activated successfully');
                return self.clients.claim();
            })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Skip chrome-extension and other non-http(s) requests
    if (!event.request.url.startsWith('http')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    // Return cached version
                    return cachedResponse;
                }

                // Not in cache, fetch from network
                return fetch(event.request)
                    .then((response) => {
                        // Don't cache non-ok responses
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            // For CDN resources, we might want to cache them
                            if (response && response.status === 200 && event.request.url.includes('cdnjs.cloudflare.com')) {
                                const responseToCache = response.clone();
                                caches.open(CACHE_NAME)
                                    .then((cache) => {
                                        cache.put(event.request, responseToCache);
                                    });
                            }
                            return response;
                        }

                        // Cache the fetched response
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    })
                    .catch(() => {
                        // Network failed, try to return a cached fallback
                        if (event.request.destination === 'document') {
                            return caches.match('./index.html');
                        }
                        return new Response('Network error', { status: 503 });
                    });
            })
    );
});

// Message event - handle cache updates
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data && event.data.type === 'CLEAR_CACHE') {
        caches.delete(CACHE_NAME)
            .then(() => {
                console.log('[Service Worker] Cache cleared');
            });
    }
});
