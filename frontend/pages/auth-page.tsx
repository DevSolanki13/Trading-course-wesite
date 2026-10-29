import { AuthForm, type AuthMode } from "../components/auth-form";
import { BookOpen, ShieldCheck, LockSimple } from "../components/icons";
import "../styles/auth.css";

export default function AuthPage({
  mode,
  admin = false,
  next,
  token,
  error,
  notice,
  invitation,
}: {
  mode: AuthMode;
  admin?: boolean;
  next?: string;
  token?: string;
  error?: string;
  notice?: string;
  invitation?: boolean;
}) {
  const compact = ["forgot", "reset", "confirm"].includes(mode);
  return (
    <main id="main-content" className={`auth-page container ${compact ? "auth-page-compact" : ""}`}>
      {!compact && (
        <div className="auth-intro">
          <span className="auth-section-label">
            {admin ? "Team access" : "Your learning space"}
          </span>
          <h1>
            {admin ? (
              <>
                A secure space
                <br />
                for your team.
              </>
            ) : (
              <>
                A clearer path.
                <br />
                An account of your own.
              </>
            )}
          </h1>
          <p>
            {admin
              ? "Staff access uses a verified account and an authenticator code. Student accounts cannot access this workspace."
              : "Keep your learning in one place. Manage your profile, account security and active devices."}
          </p>
          <ul>
            <li>
              <ShieldCheck size={20} />
              <span>Email verification and protected sessions</span>
            </li>
            <li>
              <BookOpen size={20} />
              <span>Up to two active devices</span>
            </li>
            <li>
              <LockSimple size={20} />
              <span>Device controls and secure sign-out</span>
            </li>
          </ul>
          <p className="auth-preview-note">
            Enrolment is not open in this preview. Account access does not grant a course purchase.
          </p>
        </div>
      )}
      {compact && (
        <h1 className="sr-only">
          {mode === "forgot"
            ? "Password recovery"
            : mode === "reset"
              ? "Set your password"
              : "Email confirmation"}
        </h1>
      )}
      <AuthForm
        mode={mode}
        admin={admin}
        next={next}
        token={token}
        initialError={error}
        notice={notice}
        invitation={invitation}
      />
    </main>
  );
}
