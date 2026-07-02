import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

function normalizeBasePath(path) {
    if (!path || path === '/') return '/';

    const withLeadingSlash = path.startsWith('/') ? path : `/${path}`;
    const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/, '');

    return `${withoutTrailingSlash}/`;
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');

    return {
        base: normalizeBasePath(env.PUBLIC_BASE_PATH),
        plugins: [react()],
        root: 'client',
        build: {
            emptyOutDir: true,
            outDir: '../dist',
        },
    };
});
