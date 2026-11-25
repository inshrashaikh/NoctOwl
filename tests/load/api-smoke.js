import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 10,
  duration: "30s",
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const API_TOKEN = __ENV.API_TOKEN || "";
const TEST_PHONE = __ENV.LOAD_TEST_PHONE || "+15550009001";

export function setup() {
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    "setup health is 200": (r) => r.status === 200,
  });

  const otpRes = http.post(
    `${BASE_URL}/auth/otp/request`,
    JSON.stringify({ phone: TEST_PHONE }),
    { headers: { "Content-Type": "application/json" } },
  );
  check(otpRes, {
    "setup otp request is 200": (r) => r.status === 200,
  });

  return { token: API_TOKEN };
}

export default function (data) {
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    "GET /health status 200": (r) => r.status === 200,
  });

  if (data.token) {
    const tripsRes = http.get(`${BASE_URL}/trips`, {
      headers: { Authorization: `Bearer ${data.token}` },
    });
    check(tripsRes, {
      "GET /trips status 200": (r) => r.status === 200,
    });
  }

  // Keep per-IP authenticated rate within default 100 req/min throttler ceiling
  sleep(3.5);
}
