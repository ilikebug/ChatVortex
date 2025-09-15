/** @type {import('next').NextConfig} */
const nextConfig = {
  // 启用独立输出模式，用于Docker部署
  output: 'standalone',
  
  images: {
    domains: ['localhost'],
  },
  
  // 优化Docker构建
  experimental: {
    outputFileTracingRoot: undefined,
  },
}

module.exports = nextConfig
