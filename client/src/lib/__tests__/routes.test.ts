import { describe, expect, it } from "vitest";
import { isPublicRoute } from "../routes";

describe("isPublicRoute", () => {
  it("keeps verification, embed, public tipster, legal and ranking pages independent from auth loading", () => {
    expect(isPublicRoute("/verify")).toBe(true);
    expect(isPublicRoute("/verify?code=ABCDEF12")).toBe(true);
    expect(isPublicRoute("/embed/ticket/123")).toBe(true);
    expect(isPublicRoute("/tipster/oddsmark")).toBe(true);
    expect(isPublicRoute("/privacidad")).toBe(true);
    expect(isPublicRoute("/condiciones")).toBe(true);
    expect(isPublicRoute("/juego-responsable")).toBe(true);
    expect(isPublicRoute("/soporte")).toBe(true);
    expect(isPublicRoute("/privacy")).toBe(true);
    expect(isPublicRoute("/terms")).toBe(true);
    expect(isPublicRoute("/responsible-gaming")).toBe(true);
    expect(isPublicRoute("/support")).toBe(true);
    expect(isPublicRoute("/ranking")).toBe(true);
  });

  it("keeps app and auth routes private or auth-aware", () => {
    expect(isPublicRoute("/")).toBe(false);
    expect(isPublicRoute("/auth")).toBe(false);
    expect(isPublicRoute("/profile")).toBe(false);
    expect(isPublicRoute("/tipsters")).toBe(false);
    expect(isPublicRoute("/verify-anything")).toBe(false);
  });
});
