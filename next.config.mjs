/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  eslint: { ignoreDuringBuilds: true },
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Debe cubrir el máximo de importación de copias (30 MB en
      // src/app/actions/backups.ts); con 8 MB Next rechazaba el archivo antes
      // de ejecutar la acción y la copia no se podía importar.
      bodySizeLimit: '32mb',
    },
  },
};

export default nextConfig;
