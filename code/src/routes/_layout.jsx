import { Outlet, createRootRoute, useSearch } from "@tanstack/react-router";
import { Navbar } from "@/components/smartml/Navbar";

export const Route = createRootRoute({
  component: Layout,
});

function Layout() {
  const search = useSearch({ strict: false });
  const datasetId = search.datasetId;

  return (
    <div className="min-h-screen">
      <Navbar activeDatasetId={datasetId} />
      <main className="mx-auto max-w-[1500px] px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}
