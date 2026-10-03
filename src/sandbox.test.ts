import { describe, expect, it } from "vitest";
import { isWrite } from "./sandbox";

const H = "x.supabase.co";
const at = (path: string) => `https://${H}${path}`;

describe("the trial version reads the real database and writes nothing to it", () => {
  it("lets reading and signing in through", () => {
    expect(isWrite(at("/rest/v1/tv_config?select=*"), "GET", H)).toBe(false);
    expect(isWrite(at("/auth/v1/token?grant_type=password"), "POST", H)).toBe(false);
    expect(isWrite(at("/rest/v1/rpc/my_communities"), "POST", H)).toBe(false);
    expect(isWrite(at("/storage/v1/object/public/community-media/a.jpg"), "GET", H)).toBe(false);
  });

  it("stops every save, delete, upload and changing function", () => {
    expect(isWrite(at("/rest/v1/tv_config?community_id=eq.1"), "PATCH", H)).toBe(true);
    expect(isWrite(at("/rest/v1/minyanim"), "POST", H)).toBe(true);
    expect(isWrite(at("/rest/v1/minyanim?id=eq.1"), "DELETE", H)).toBe(true);
    expect(isWrite(at("/storage/v1/object/community-media/a.jpg"), "POST", H)).toBe(true);
    expect(isWrite(at("/rest/v1/rpc/tv_set_community"), "POST", H)).toBe(true);
    expect(isWrite(at("/rest/v1/rpc/create_community"), "POST", H)).toBe(true);
  });

  it("leaves other sites alone", () => {
    expect(isWrite("https://api.anthropic.com/v1/models", "POST", H)).toBe(false);
  });
});
