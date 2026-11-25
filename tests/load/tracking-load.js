import http from "k6/http";
import { check, fail, sleep } from "k6";

export const options = {
  vus: 50,
  duration: "60s",
  thresholds: {
    http_req_duration: ["p(95)<300"],
    http_req_failed: ["rate<0.01"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const API_TOKEN = __ENV.API_TOKEN || "";
const TRIP_ID = __ENV.TRIP_ID || "";

export function setup() {
  if (!API_TOKEN || !TRIP_ID) {
    fail("API_TOKEN and TRIP_ID env vars are required for tracking-load.js");
  }
  return { token: API_TOKEN, tripId: TRIP_ID };
}

export default function (data) {
  const payload = JSON.stringify({
    lat: 37.7749 + (Math.random() - 0.5) * 0.02,
    lon: -122.4194 + (Math.random() - 0.5) * 0.02,
    speed: 10 + Math.random() * 15,
    accuracy: 5.0,
    heading: 180,
    timestamp: new Date().toISOString(),
  });

  const res = http.post(
    `${BASE_URL}/trips/${data.tripId}/locations`,
    payload,
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.token}`,
      },
    },
  );

  check(res, {
    "POST /trips/:id/locations status 201": (r) => r.status === 201,
  });

  sleep(2);
}
