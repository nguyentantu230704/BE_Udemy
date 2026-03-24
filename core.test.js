describe("Auth API", () => {
  const request = require("supertest");
  const app = require("../app");

  test("TC01 - Register success", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: "test@gmail.com",
      password: "123456",
    });

    expect(res.statusCode).toBe(201);
    expect(res.body.message).toBe("Đăng ký thành công");
  });

  test("TC02 - Register duplicate email", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: "test@gmail.com",
      password: "123456",
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Email này đã được sử dụng");
  });

  test("TC03 - Login success", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "test@gmail.com",
      password: "123456",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  test("TC04 - Login wrong password", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "test@gmail.com",
      password: "wrong",
    });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe("Email hoặc mật khẩu không đúng");
  });

  test("TC05 - Forgot password", async () => {
    const res = await request(app).post("/api/auth/forgot-password").send({
      email: "test@gmail.com",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("Gửi mail reset");
  });
});
describe("Course API", () => {
  const request = require("supertest");
  const app = require("../app");

  test("TC06 - Get course list", async () => {
    const res = await request(app).get("/api/courses");

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("TC07 - Search course", async () => {
    const res = await request(app)
      .get("/api/courses/search")
      .query({ keyword: "Kinh Doanh" });

    expect(res.statusCode).toBe(200);
  });

  test("TC08 - Get course detail", async () => {
    const res = await request(app).get("/api/courses/1");

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("title");
  });

  test("TC09 - Preview course", async () => {
    const res = await request(app).get("/api/courses/1/preview");

    expect(res.statusCode).toBe(200);
  });
});
describe("Course API", () => {
  const request = require("supertest");
  const app = require("../app");

  test("TC06 - Get course list", async () => {
    const res = await request(app).get("/api/courses");

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("TC07 - Search course", async () => {
    const res = await request(app)
      .get("/api/courses/search")
      .query({ keyword: "Kinh Doanh" });

    expect(res.statusCode).toBe(200);
  });

  test("TC08 - Get course detail", async () => {
    const res = await request(app).get("/api/courses/1");

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("title");
  });

  test("TC09 - Preview course", async () => {
    const res = await request(app).get("/api/courses/1/preview");

    expect(res.statusCode).toBe(200);
  });
});
describe("Cart & Payment", () => {
  const request = require("supertest");
  const app = require("../app");

  let token = "mock-token";

  test("TC10 - Add to cart", async () => {
    const res = await request(app)
      .post("/api/cart")
      .set("Authorization", `Bearer ${token}`)
      .send({ courseId: 1 });

    expect(res.statusCode).toBe(200);
  });

  test("TC11 - Remove from cart", async () => {
    const res = await request(app)
      .delete("/api/cart/1")
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
  });

  test("TC12 - Payment success", async () => {
    const res = await request(app)
      .post("/api/payment")
      .send({ method: "vnpay" });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("Thanh toán OK");
  });

  test("TC13 - Payment fail", async () => {
    const res = await request(app)
      .post("/api/payment")
      .send({ method: "vnpay_fail" });

    expect(res.statusCode).toBe(400);
  });
});
describe("Learning", () => {
  const request = require("supertest");
  const app = require("../app");

  let token = "mock-token";

  test("TC14 - View lesson", async () => {
    const res = await request(app)
      .get("/api/lessons/1")
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
  });

  test("TC15 - Mark complete", async () => {
    const res = await request(app)
      .post("/api/progress")
      .set("Authorization", `Bearer ${token}`)
      .send({ lessonId: 1 });

    expect(res.statusCode).toBe(200);
  });

  test("TC16 - Submit quiz", async () => {
    const res = await request(app)
      .post("/api/quiz")
      .set("Authorization", `Bearer ${token}`)
      .send({ answers: [] });

    expect(res.statusCode).toBe(200);
  });

  test("TC17 - Get certificate", async () => {
    const res = await request(app)
      .get("/api/certificate/1")
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
  });
});
