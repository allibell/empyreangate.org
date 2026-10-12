import { describe, expect, test } from "bun:test";
import { buildKind } from "./build-context";

describe("buildKind", () => {
  test("local and GitHub Actions builds are production", () => {
    expect(buildKind({})).toBe("production");
    expect(buildKind({ CI: "true", GITHUB_ACTIONS: "true" })).toBe(
      "production",
    );
  });

  test("a Workers Builds build of master is production", () => {
    expect(buildKind({ WORKERS_CI: "1", WORKERS_CI_BRANCH: "master" })).toBe(
      "production",
    );
  });

  test("a Workers Builds build of any other branch is a preview", () => {
    expect(buildKind({ WORKERS_CI: "1", WORKERS_CI_BRANCH: "dev" })).toBe(
      "preview",
    );
    expect(
      buildKind({ WORKERS_CI: "1", WORKERS_CI_BRANCH: "feature/photos" }),
    ).toBe("preview");
  });

  test("refuses to guess when Workers Builds gives no branch", () => {
    expect(() => buildKind({ WORKERS_CI: "1" })).toThrow(/WORKERS_CI_BRANCH/);
  });
});
