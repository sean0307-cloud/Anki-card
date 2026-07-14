// [user]/layout.tsx
// 提供 generateStaticParams 給靜態 fallback（Vercel 不需要，但保留供本地 build 用）
// Vercel 部署時自動支援動態路由，無需此設定

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
