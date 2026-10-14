import { Badge } from "@/components/ui/badge";
import { copy } from "@/lib/copy";
import type { AccessState } from "../schema";

const VARIANT = {
  trial: "warning",
  trial_ended: "danger",
  paid: "success",
  suspended: "muted",
} as const;

export function AccessBadge({ access }: { access: AccessState }) {
  return <Badge variant={VARIANT[access]}>{copy.admin.access[access]}</Badge>;
}
