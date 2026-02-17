import request from "supertest";
import app from "../index";

describe("API endpoint /api", () => {
  // GET - Hello Boomers response
  it("should return response from /api", async () => {
    const res = await request(app).get("/api").expect("Content-Type", /json/);
    expect(res.status).toEqual(200);
    expect(res.body.message).toEqual("Hello boomers");
  });

  // GET - Invalid path
  it("should return Not Found", async () => {
    const res = await request(app).get("/INVALID_PATH");
    expect(res.status).toEqual(404);
  });
});
