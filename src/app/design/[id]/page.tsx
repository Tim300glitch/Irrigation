import { DesignPage } from "./DesignPage";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DesignPage id={id} />;
}
