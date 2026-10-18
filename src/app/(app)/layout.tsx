import { Nav } from "@/components/nav";
import { requireUser } from "@/lib/auth";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  return (
    <>
      <Nav email={user.email} />
      <main className="flex-1 px-1 pb-6 pt-2 sm:px-3">{children}</main>
    </>
  );
}
