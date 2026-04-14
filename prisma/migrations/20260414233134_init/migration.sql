-- CreateTable
CREATE TABLE "Segment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "segmentId" TEXT NOT NULL,
    "roadName" TEXT NOT NULL,
    "geometryRef" TEXT,
    "roadType" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TrafficObservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "segmentId" TEXT NOT NULL,
    "timestampUtc" DATETIME NOT NULL,
    "speed" REAL,
    "freeFlowSpeed" REAL,
    "congestionLabel" TEXT,
    "source" TEXT NOT NULL,
    "qualityStatus" TEXT,
    "ingestionRunId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrafficObservation_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "Segment" ("segmentId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FeatureSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "segmentId" TEXT NOT NULL,
    "timestampUtc" DATETIME NOT NULL,
    "hourOfDay" INTEGER,
    "dayOfWeek" INTEGER,
    "weekendFlag" BOOLEAN,
    "holidayFlag" BOOLEAN,
    "recentObservedSpeed" REAL,
    "rollingMeanSpeed" REAL,
    "rollingStdSpeed" REAL,
    "relativeToFreeFlow" REAL,
    "speedChangeRate" REAL,
    "incidentFlag" BOOLEAN,
    "roadCategory" TEXT,
    "target" TEXT,
    "featureVersion" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeatureSnapshot_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "Segment" ("segmentId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Prediction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "segmentId" TEXT NOT NULL,
    "timestampUtc" DATETIME NOT NULL,
    "predictedLabel" TEXT NOT NULL,
    "confidence" REAL,
    "modelVersion" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Prediction_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "Segment" ("segmentId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScenarioResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scenarioId" TEXT NOT NULL,
    "metricName" TEXT NOT NULL,
    "metricValue" REAL NOT NULL,
    "notes" TEXT,
    "scenarioVersion" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "IngestionRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME,
    "status" TEXT NOT NULL,
    "quotaUsage" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ModelRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "datasetRange" TEXT NOT NULL,
    "metricsJson" TEXT,
    "artifactPath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Segment_segmentId_key" ON "Segment"("segmentId");

-- CreateIndex
CREATE INDEX "TrafficObservation_segmentId_timestampUtc_idx" ON "TrafficObservation"("segmentId", "timestampUtc");

-- CreateIndex
CREATE INDEX "FeatureSnapshot_segmentId_timestampUtc_idx" ON "FeatureSnapshot"("segmentId", "timestampUtc");

-- CreateIndex
CREATE INDEX "Prediction_segmentId_timestampUtc_idx" ON "Prediction"("segmentId", "timestampUtc");

-- CreateIndex
CREATE INDEX "ScenarioResult_scenarioId_idx" ON "ScenarioResult"("scenarioId");

-- CreateIndex
CREATE UNIQUE INDEX "IngestionRun_runId_key" ON "IngestionRun"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "ModelRun_runId_key" ON "ModelRun"("runId");
