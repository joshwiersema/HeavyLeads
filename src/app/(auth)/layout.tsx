export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <main id="main-content" className="w-full max-w-md">{children}</main>
    </div>
  );
}
