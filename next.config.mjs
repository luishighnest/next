/** @type {import('next').NextConfig} */
const nextConfig = {
    async rewrites() {
        return [
            {
                source: '/evento/:slug*',
                destination: '/eventi/:slug*',
            },
        ];
    },
};

export default nextConfig;
