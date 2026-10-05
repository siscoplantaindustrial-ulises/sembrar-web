import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

// Sitio estático; solo /api/plano corre como función serverless.
export default defineConfig({ adapter: vercel() });
