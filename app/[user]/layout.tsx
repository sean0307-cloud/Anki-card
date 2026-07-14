// generateStaticParams 供靜態匯出（GitHub Pages）使用
// 定義四個固定的用戶 ID
export function generateStaticParams() {
  return [
    { user: "brother1" },
    { user: "brother2" },
    { user: "mom" },
    { user: "dad" },
  ];
}

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
