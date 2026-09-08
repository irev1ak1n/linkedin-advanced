import type { LinkedInProfile } from "../../models/profile";
import type { ActiveProfileStatus } from "../hooks/useActiveProfile";

interface ProfileBannerProps {
  status: ActiveProfileStatus;
  profile: LinkedInProfile | null;
}

export function ProfileBanner({ status, profile }: ProfileBannerProps) {
  if (status === "unsupported") {
    return (
      <div className="banner banner--info">Open a LinkedIn profile page (linkedin.com/in/…) to see a match score.</div>
    );
  }

  if (status === "loading" || !profile) {
    return <div className="banner banner--info">Reading the current profile…</div>;
  }

  if (!profile.extracted) {
    return (
      <div className="banner banner--warning">
        This profile hasn't finished rendering yet, or Finder couldn't read it. Try scrolling the page.
      </div>
    );
  }

  return (
    <div className="banner banner--profile">
      <div className="banner__name">{profile.name ?? "Unnamed profile"}</div>
      {profile.headline && <div className="banner__headline">{profile.headline}</div>}
    </div>
  );
}
