/**
 * API Endpoints · Carpeta de endpoints para la web
 * ────────────────────────────────────────────────────────────────
 * Cada módulo exporta un array de objetos con la forma:
 *   { name, path, method, tier, description }
 *
 * tier: 'free' | 'premium' | 'híbrido'
 */
export { endpoints } from './catalog.js';
export { createEndpointsRouter } from './router.js';