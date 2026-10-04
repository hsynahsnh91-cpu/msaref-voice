import { SignInForm } from "@/components/SignInForm";
import { AuthHeading } from "./heading";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  return (
    <div className="space-y-6">
      <AuthHeading mode="in" />
      <SignInForm mode="in" />
    </div>
  );
}
