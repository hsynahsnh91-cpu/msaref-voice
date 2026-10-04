import { SignInForm } from "@/components/SignInForm";
import { AuthHeading } from "../sign-in/heading";

export const dynamic = "force-dynamic";

export default function SignUpPage() {
  return (
    <div className="space-y-6">
      <AuthHeading mode="up" />
      <SignInForm mode="up" />
    </div>
  );
}
