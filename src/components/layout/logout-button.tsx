import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logOut } from "@/features/auth/actions";
import { copy } from "@/lib/copy";

export function LogoutButton() {
  return (
    <form action={logOut}>
      <Button type="submit" variant="ghost">
        <LogOut aria-hidden />
        {copy.auth.logout}
      </Button>
    </form>
  );
}
