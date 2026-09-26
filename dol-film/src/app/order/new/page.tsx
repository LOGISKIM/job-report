import { notFound } from "next/navigation";
import { getTemplate } from "@/lib/catalog";
import { Wizard } from "./wizard";

export default async function NewOrderPage(props: PageProps<"/order/new">) {
  const q = await props.searchParams;
  const t = typeof q.template === "string" ? getTemplate(q.template) : undefined;
  if (!t) notFound();
  return <Wizard templateId={t.id} />;
}
