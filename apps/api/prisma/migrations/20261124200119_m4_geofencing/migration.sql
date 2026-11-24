-- CreateEnum
CREATE TYPE "GeofenceEventType" AS ENUM ('ENTER', 'EXIT');

-- CreateTable
CREATE TABLE "SafeZone" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "geometry" JSONB NOT NULL,
    "radius" DOUBLE PRECISION,
    "centerLat" DOUBLE PRECISION,
    "centerLon" DOUBLE PRECISION,
    "color" TEXT NOT NULL DEFAULT '#3B82F6',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SafeZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeofenceEvent" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "safeZoneId" TEXT NOT NULL,
    "eventType" "GeofenceEventType" NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeofenceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SafeZone_userId_active_idx" ON "SafeZone"("userId", "active");

-- CreateIndex
CREATE INDEX "GeofenceEvent_tripId_occurredAt_idx" ON "GeofenceEvent"("tripId", "occurredAt");

-- AddForeignKey
ALTER TABLE "SafeZone" ADD CONSTRAINT "SafeZone_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeofenceEvent" ADD CONSTRAINT "GeofenceEvent_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeofenceEvent" ADD CONSTRAINT "GeofenceEvent_safeZoneId_fkey" FOREIGN KEY ("safeZoneId") REFERENCES "SafeZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
