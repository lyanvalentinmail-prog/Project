/**
 * Router de API endpoints
 * ────────────────────────────────────────────────────────────────
 * Sirve el catálogo de endpoints y estadísticas.
 */
import express from 'express';
import { endpoints, totalEndpoints, countByTier } from './catalog.js';

export function createEndpointsRouter() {
  const router = express.Router();

  // Listar todos los endpoints agrupados por categoría
  router.get('/catalog', (_req, res) => {
    res.json({
      ok: true,
      total: totalEndpoints(),
      tiers: countByTier(),
      categories: endpoints.map((cat) => ({
        name: cat.category,
        icon: cat.icon,
        count: cat.items.length,
        items: cat.items,
      })),
    });
  });

  // Estadísticas rápidas
  router.get('/stats', (_req, res) => {
    res.json({
      ok: true,
      totalEndpoints: totalEndpoints(),
      tiers: countByTier(),
      categories: endpoints.length,
    });
  });

  return router;
}