import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { NodeSDK } from '@opentelemetry/sdk-node';

const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
const isTestEnv = process.env.NODE_ENV === 'test';

let sdk: NodeSDK | null = null;

if (!isTestEnv && process.env.OTEL_ENABLED !== 'false') {
  sdk = new NodeSDK({
    serviceName: 'noctowl-api',
    ...(otlpEndpoint
      ? {
          traceExporter: new OTLPTraceExporter({
            url: otlpEndpoint,
          }),
        }
      : {}),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  sdk.start();

  const shutdown = () => {
    void sdk?.shutdown().catch(() => undefined);
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

export { sdk };
