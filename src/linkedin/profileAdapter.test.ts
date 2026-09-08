// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { extractLinkedInProfile } from "./profileAdapter";

function setBody(html: string): void {
  document.body.innerHTML = html;
}

/** A synthetic but structurally realistic profile page: a top card with name/headline/
 * location, and About/Experience/Education/Skills sections each with a heading and repeated
 * list items — mirroring the shape real-Chrome verification will be checked against. */
function setFullProfilePage(): void {
  setBody(`
    <main role="main">
      <section>
        <h1><span aria-hidden="true">Jordan Rivera</span></h1>
        <div><span aria-hidden="true">FRC mentor and robotics coach</span></div>
        <div><span>Austin, Texas Area</span></div>
      </section>
      <section>
        <h2>About</h2>
        <span aria-hidden="true">I have spent 8 years as an FRC mentor, helping student teams design and build competition robots.…see more</span>
      </section>
      <section>
        <h2>Experience</h2>
        <ul>
          <li>
            <span aria-hidden="true">Robotics Mentor</span>
            <span aria-hidden="true">Local FRC Team</span>
            <span aria-hidden="true">Coach students on mechanical design, programming, and competition strategy for the annual FIRST Robotics Competition season.</span>
          </li>
          <li>
            <span aria-hidden="true">Software Engineer</span>
            <span aria-hidden="true">Acme Corp</span>
          </li>
        </ul>
      </section>
      <section>
        <h2>Education</h2>
        <ul>
          <li>
            <span aria-hidden="true">University of Texas</span>
            <span aria-hidden="true">B.S. Mechanical Engineering</span>
          </li>
        </ul>
      </section>
      <section>
        <h2>Skills</h2>
        <ul>
          <li><span aria-hidden="true">Python</span></li>
          <li><span aria-hidden="true">Robotics</span></li>
          <li><span aria-hidden="true">Mentoring</span></li>
        </ul>
      </section>
    </main>
  `);
}

describe("extractLinkedInProfile - full profile", () => {
  it("extracts name and headline", () => {
    setFullProfilePage();
    const profile = extractLinkedInProfile(document);
    expect(profile.extracted).toBe(true);
    expect(profile.name).toBe("Jordan Rivera");
    expect(profile.headline).toBe("FRC mentor and robotics coach");
  });

  it("extracts the About section without the trailing 'see more' control text", () => {
    setFullProfilePage();
    const profile = extractLinkedInProfile(document);
    expect(profile.about).toContain("FRC mentor");
    expect(profile.about).not.toContain("see more");
  });

  it("extracts experience entries with title, company, and description", () => {
    setFullProfilePage();
    const profile = extractLinkedInProfile(document);
    expect(profile.experience.length).toBeGreaterThanOrEqual(2);
    expect(profile.experience[0].title).toBe("Robotics Mentor");
    expect(profile.experience[0].company).toBe("Local FRC Team");
    expect(profile.experience[0].description).toContain("FIRST Robotics Competition");
  });

  it("extracts education entries", () => {
    setFullProfilePage();
    const profile = extractLinkedInProfile(document);
    expect(profile.education).toHaveLength(1);
    expect(profile.education[0].school).toBe("University of Texas");
  });

  it("extracts skills", () => {
    setFullProfilePage();
    const profile = extractLinkedInProfile(document);
    expect(profile.skills).toContain("Python");
    expect(profile.skills).toContain("Robotics");
  });

  it("never doubles text that has both an aria-hidden copy and a screen-reader-only copy", () => {
    setBody(`
      <main role="main">
        <section>
          <h1>
            <span aria-hidden="true">Jordan Rivera</span>
            <span class="visually-hidden">Jordan Rivera</span>
          </h1>
        </section>
      </main>
    `);
    const profile = extractLinkedInProfile(document);
    expect(profile.name).toBe("Jordan Rivera");
  });
});

describe("extractLinkedInProfile - incomplete or non-profile pages", () => {
  it("reports extracted:false when there is no h1 or headline to find at all", () => {
    setBody('<main role="main"><div>unrelated content</div></main>');
    const profile = extractLinkedInProfile(document);
    expect(profile.extracted).toBe(false);
    expect(profile.name).toBeUndefined();
  });

  it("never invents experience/education/skills that aren't present", () => {
    setBody('<main role="main"><h1><span aria-hidden="true">Jordan Rivera</span></h1></main>');
    const profile = extractLinkedInProfile(document);
    expect(profile.extracted).toBe(true);
    expect(profile.experience).toEqual([]);
    expect(profile.education).toEqual([]);
    expect(profile.skills).toEqual([]);
  });
});

describe("extractLinkedInProfile - determinism", () => {
  it("produces identical output across repeated calls on the same DOM", () => {
    setFullProfilePage();
    const first = extractLinkedInProfile(document);
    const second = extractLinkedInProfile(document);
    expect(second).toEqual(first);
  });
});
