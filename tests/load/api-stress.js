import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "30s", target: 10 },
    { duration: "45s", target: 100 },
    { duration: "30s", target: 200 },
    { duration: "15s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<1000"],
    http_req_failed: ["rate<0.05"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const API_TOKEN = __ENV.API_TOKEN || "";
const TRIP_ID = __ENV.TRIP_ID || "";
const TEST_PHONE = __ENV.LOAD_TEST_PHONE || "+15550009002";

export function setup() {
  const otpRes = http.post(
    `${BASE_URL}/auth/otp/request`,
    JSON.stringify({ phone: TEST_PHONE }),
    { headers: { "Content-Type": "application/json" } },
  );
  check(otpRes, {
    "setup otp status is 200 or 429": (r) =>
      r.status === 200 || r.status === 429,
  });
  return { token: API_TOKEN, tripId: TRIP_ID };
}

export default function (data) {
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, { "health 200": (r) => r.status === 200 });

  if (data.token) {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.token}`,
    };
    const tripsRes = http.get(`${BASE_URL}/trips`, { headers });
    check(tripsRes, { "trips 200": (r) => r.status === 200 });

    if (data.tripId) {
      const payload = JSON.stringify({
        lat: 37.7749 + (Math.random() - 0.5) * 0.01,
        lon: -122.4194 + (Math.random() - 0.5) * 0.01,
        speed: 12.5,
        accuracy: 8.0,
        heading: 90,
        timestamp: new Date().toISOString(),
      });
      const locRes = http.post(
        `${BASE_URL}/trips/${data.tripId}/locations`,
        payload,
        { headers },
      );
      check(locRes, { "tracking ingest 201": (r) => r.status === 201 });
    }
  }

  sleep(1);
}
